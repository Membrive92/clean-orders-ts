import pg from 'pg';
import { ok, fail } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { UnitOfWork, Repositories } from '../../application/ports/UnitOfWork.js';
import type { OrderRepository } from '../../application/ports/OrderRepository.js';
import type { Order } from '../../domain/entities/Order.js';
import { Order as OrderEntity } from '../../domain/entities/Order.js';
import { Currency } from '../../domain/value-objects/Currency.js';
import { SKU } from '../../domain/value-objects/SKU.js';
import { Quantity } from '../../domain/value-objects/Quantity.js';
import { Money } from '../../domain/value-objects/Money.js';
import { OutboxEventBus } from '../messaging/OutboxEventBus.js';

const { Pool } = pg;

interface OrderRow {
  id: string;
  currency: string;
  status: 'DRAFT' | 'CONFIRMED' | 'FINALIZED' | 'CANCELLED';
  created_at: Date;
  updated_at: Date;
}

interface OrderItemRow {
  id: number;
  order_id: string;
  sku: string;
  quantity: number;
  unit_price_amount: string;
  unit_price_currency: string;
  created_at: Date;
}

/**
 * OrderRepository implementation that uses a provided PostgreSQL client
 * Used within the context of a Unit of Work transaction
 */
class TransactionalOrderRepository implements OrderRepository {
  constructor(private client: pg.PoolClient) {}

  async save(order: Order): Promise<Result<void, string>> {
    try {
      // UPSERT order
      await this.client.query(
        `INSERT INTO orders (id, currency, status, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [order.id, order.currency.toString(), order.getStatus()]
      );

      // Delete existing items and insert new ones
      await this.client.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);

      // Insert all items
      const items = order.getItems();
      for (const item of items) {
        await this.client.query(
          `INSERT INTO order_items (order_id, sku, quantity, unit_price_amount, unit_price_currency, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [
            order.id,
            item.sku.toString(),
            item.quantity.value,
            item.unitPrice.amount.toString(),
            item.unitPrice.currency.toString(),
          ]
        );
      }

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error saving order';
      return fail(`Failed to save order: ${message}`);
    }
  }

  async findById(id: string): Promise<Result<Order | null, string>> {
    try {
      // Get order
      const orderResult = await this.client.query<OrderRow>(
        'SELECT id, currency, status, created_at, updated_at FROM orders WHERE id = $1',
        [id]
      );

      if (orderResult.rows.length === 0) {
        return ok(null);
      }

      const orderRow = orderResult.rows[0];

      // Get order items
      const itemsResult = await this.client.query<OrderItemRow>(
        `SELECT id, order_id, sku, quantity, unit_price_amount, unit_price_currency, created_at
         FROM order_items
         WHERE order_id = $1
         ORDER BY id ASC`,
        [id]
      );

      // Reconstruct Order aggregate
      const currencyResult = Currency.create(orderRow.currency);
      if (!currencyResult.success) {
        return fail(`Invalid currency in database: ${orderRow.currency}`);
      }

      const orderResult2 = OrderEntity.create(orderRow.id, currencyResult.value);
      if (!orderResult2.success) {
        return fail(orderResult2.error);
      }

      const order = orderResult2.value;

      // Add items to order
      for (const itemRow of itemsResult.rows) {
        const skuResult = SKU.create(itemRow.sku);
        if (!skuResult.success) {
          return fail(`Invalid SKU: ${skuResult.error}`);
        }

        const quantityResult = Quantity.create(itemRow.quantity);
        if (!quantityResult.success) {
          return fail(`Invalid quantity: ${quantityResult.error}`);
        }

        const itemCurrencyResult = Currency.create(itemRow.unit_price_currency);
        if (!itemCurrencyResult.success) {
          return fail(`Invalid item currency: ${itemRow.unit_price_currency}`);
        }

        const unitPriceResult = Money.create(
          parseFloat(itemRow.unit_price_amount),
          itemCurrencyResult.value
        );
        if (!unitPriceResult.success) {
          return fail(`Invalid unit price: ${unitPriceResult.error}`);
        }

        const addResult = order.addItem(
          skuResult.value,
          quantityResult.value,
          unitPriceResult.value
        );
        if (!addResult.success) {
          return fail(`Failed to add item: ${addResult.error}`);
        }
      }

      // Restore status
      if (orderRow.status === 'CONFIRMED') {
        const confirmResult = order.confirm();
        if (!confirmResult.success) {
          return fail(`Failed to confirm order: ${confirmResult.error}`);
        }
      } else if (orderRow.status === 'FINALIZED') {
        const confirmResult = order.confirm();
        if (!confirmResult.success) {
          return fail(`Failed to confirm order: ${confirmResult.error}`);
        }
        const finalizeResult = order.finalize();
        if (!finalizeResult.success) {
          return fail(`Failed to finalize order: ${finalizeResult.error}`);
        }
      } else if (orderRow.status === 'CANCELLED') {
        const cancelResult = order.cancel();
        if (!cancelResult.success) {
          return fail(`Failed to cancel order: ${cancelResult.error}`);
        }
      }

      // Clear domain events (they came from DB, not new events)
      order.clearDomainEvents();

      return ok(order);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error finding order';
      return fail(`Failed to find order: ${message}`);
    }
  }

  async update(order: Order): Promise<Result<void, string>> {
    // Check if order exists
    const findResult = await this.findById(order.id);
    if (!findResult.success) {
      return fail(findResult.error);
    }

    if (findResult.value === null) {
      return fail(`Order with ID ${order.id} not found`);
    }

    // Use save which implements UPSERT
    return this.save(order);
  }

  async findAll(limit?: number, offset?: number): Promise<Result<Order[], string>> {
    try {
      // Build query with optional pagination
      let query = 'SELECT id, currency, status, created_at, updated_at FROM orders ORDER BY created_at DESC';
      const params: any[] = [];

      if (limit !== undefined && limit > 0) {
        params.push(limit);
        query += ` LIMIT $${params.length}`;
      }

      if (offset !== undefined && offset > 0) {
        params.push(offset);
        query += ` OFFSET $${params.length}`;
      }

      const orderResult = await this.client.query<OrderRow>(query, params);

      // Reconstruct each order
      const orders: Order[] = [];
      for (const orderRow of orderResult.rows) {
        const orderResult = await this.findById(orderRow.id);
        if (!orderResult.success) {
          return fail(orderResult.error);
        }

        if (orderResult.value !== null) {
          orders.push(orderResult.value);
        }
      }

      return ok(orders);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error finding orders';
      return fail(`Failed to find orders: ${message}`);
    }
  }
}

/**
 * PostgreSQL implementation of Unit of Work pattern
 * Manages database transactions and provides transactional repositories
 */
export class PostgresUnitOfWork implements UnitOfWork {
  private pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Execute work within a transaction
   * Automatically handles BEGIN, COMMIT, and ROLLBACK
   * Provides transactional repositories to the work function
   */
  async run<T>(
    work: (repositories: Repositories) => Promise<Result<T, string>>
  ): Promise<Result<T, string>> {
    const client = await this.pool.connect();

    try {
      // Begin transaction
      await client.query('BEGIN');

      // Create transactional repositories and services
      const repositories: Repositories = {
        orders: new TransactionalOrderRepository(client),
        eventBus: new OutboxEventBus(client),
      };

      // Execute work
      const result = await work(repositories);

      // Commit or rollback based on result
      if (result.success) {
        await client.query('COMMIT');
      } else {
        await client.query('ROLLBACK');
      }

      return result;
    } catch (error) {
      // Rollback on unexpected error
      await client.query('ROLLBACK');
      const message = error instanceof Error ? error.message : 'Unknown error';
      return fail(`Transaction failed: ${message}`);
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  /**
   * Close the connection pool
   * Should be called when shutting down the application
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check - test database connection
   */
  async healthCheck(): Promise<Result<void, string>> {
    try {
      await this.pool.query('SELECT 1');
      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return fail(`Database health check failed: ${message}`);
    }
  }
}
