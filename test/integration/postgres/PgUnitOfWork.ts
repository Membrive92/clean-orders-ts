import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgresUnitOfWork } from '../../../src/infrastructure/postgres/PostgresUnitOfWork.js';
import { Order } from '../../../src/domain/entities/Order.js';
import { Currency } from '../../../src/domain/value-objects/Currency.js';
import { SKU } from '../../../src/domain/value-objects/SKU.js';
import { Quantity } from '../../../src/domain/value-objects/Quantity.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { config } from '../../../src/composition/config.js';
import { ok, fail } from '../../../src/shared/result.js';
import pg from 'pg';

const { Pool } = pg;

describe('PostgresUnitOfWork - Integration Tests', () => {
  let unitOfWork: PostgresUnitOfWork;
  let pool: pg.Pool;

  beforeAll(async () => {
    // Skip tests if USE_INMEMORY is true
    if (config.USE_INMEMORY) {
      console.log('⚠️  Skipping PostgreSQL UnitOfWork tests (USE_INMEMORY=true)');
      return;
    }

    unitOfWork = new PostgresUnitOfWork(config.DATABASE_URL);
    pool = new Pool({ connectionString: config.DATABASE_URL });

    // Ensure database is ready
    const healthCheck = await unitOfWork.healthCheck();
    if (!healthCheck.success) {
      throw new Error(`Database not available: ${healthCheck.error}`);
    }
  });

  afterAll(async () => {
    if (config.USE_INMEMORY) return;
    
    await unitOfWork.close();
    await pool.end();
  });

  beforeEach(async () => {
    if (config.USE_INMEMORY) return;

    // Clean up database before each test
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
  });

  it('should commit transaction on success', async () => {
    if (config.USE_INMEMORY) return;

    const result = await unitOfWork.run(async (repos) => {
      // Create and save order
      const currencyResult = Currency.create('USD');
      if (!currencyResult.success) return fail(currencyResult.error);

      const orderResult = Order.create('uow-order-1', currencyResult.value);
      if (!orderResult.success) return fail(orderResult.error);

      const order = orderResult.value;

      const sku = SKU.create('ITEM-UOW-1');
      const qty = Quantity.create(3);
      const price = Money.create(25.50, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) {
        return fail('Failed to create value objects');
      }

      const addResult = order.addItem(sku.value, qty.value, price.value);
      if (!addResult.success) return fail(addResult.error);

      const saveResult = await repos.orders.save(order);
      if (!saveResult.success) return fail(saveResult.error);

      return ok('Order saved successfully');
    });

    expect(result.success).toBe(true);

    // Verify order was committed to database
    const checkResult = await pool.query('SELECT * FROM orders WHERE id = $1', ['uow-order-1']);
    expect(checkResult.rows.length).toBe(1);
    expect(checkResult.rows[0].status).toBe('DRAFT');

    const itemsResult = await pool.query('SELECT * FROM order_items WHERE order_id = $1', ['uow-order-1']);
    expect(itemsResult.rows.length).toBe(1);
    expect(itemsResult.rows[0].sku).toBe('ITEM-UOW-1');
  });

  it('should rollback transaction on business logic failure', async () => {
    if (config.USE_INMEMORY) return;

    const result = await unitOfWork.run(async (repos) => {
      // Create and save first order
      const currencyResult = Currency.create('EUR');
      if (!currencyResult.success) return fail(currencyResult.error);

      const order1Result = Order.create('uow-order-2', currencyResult.value);
      if (!order1Result.success) return fail(order1Result.error);

      const order1 = order1Result.value;

      const sku1 = SKU.create('ITEM-A');
      const qty1 = Quantity.create(1);
      const price1 = Money.create(10.00, currencyResult.value);

      if (!sku1.success || !qty1.success || !price1.success) {
        return fail('Failed to create value objects');
      }

      order1.addItem(sku1.value, qty1.value, price1.value);
      await repos.orders.save(order1);

      // Intentionally fail the transaction
      return fail('Simulated business logic error');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Simulated business logic error');
    }

    // Verify nothing was committed
    const checkResult = await pool.query('SELECT * FROM orders WHERE id = $1', ['uow-order-2']);
    expect(checkResult.rows.length).toBe(0);

    const itemsResult = await pool.query('SELECT COUNT(*) as count FROM order_items');
    expect(parseInt(itemsResult.rows[0].count)).toBe(0);
  });

  it('should rollback on exception during work', async () => {
    if (config.USE_INMEMORY) return;

    const result = await unitOfWork.run(async (repos) => {
      // Create order
      const currencyResult = Currency.create('MXN');
      if (!currencyResult.success) return fail(currencyResult.error);

      const orderResult = Order.create('uow-order-3', currencyResult.value);
      if (!orderResult.success) return fail(orderResult.error);

      const order = orderResult.value;

      const sku = SKU.create('ITEM-B');
      const qty = Quantity.create(2);
      const price = Money.create(15.00, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) {
        return fail('Failed to create value objects');
      }

      order.addItem(sku.value, qty.value, price.value);
      await repos.orders.save(order);

      // Simulate an exception
      throw new Error('Unexpected error occurred');
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Transaction failed');
    }

    // Verify rollback happened
    const checkResult = await pool.query('SELECT * FROM orders WHERE id = $1', ['uow-order-3']);
    expect(checkResult.rows.length).toBe(0);
  });

  it('should handle multiple operations in single transaction', async () => {
    if (config.USE_INMEMORY) return;

    const result = await unitOfWork.run(async (repos) => {
      const currencyResult = Currency.create('USD');
      if (!currencyResult.success) return fail(currencyResult.error);

      // Create first order
      const order1Result = Order.create('uow-multi-1', currencyResult.value);
      if (!order1Result.success) return fail(order1Result.error);

      const order1 = order1Result.value;

      const sku1 = SKU.create('MULTI-ITEM-1');
      const qty1 = Quantity.create(1);
      const price1 = Money.create(100.00, currencyResult.value);

      if (!sku1.success || !qty1.success || !price1.success) {
        return fail('Failed to create value objects');
      }

      order1.addItem(sku1.value, qty1.value, price1.value);
      await repos.orders.save(order1);

      // Create second order
      const order2Result = Order.create('uow-multi-2', currencyResult.value);
      if (!order2Result.success) return fail(order2Result.error);

      const order2 = order2Result.value;

      const sku2 = SKU.create('MULTI-ITEM-2');
      const qty2 = Quantity.create(2);
      const price2 = Money.create(50.00, currencyResult.value);

      if (!sku2.success || !qty2.success || !price2.success) {
        return fail('Failed to create value objects');
      }

      order2.addItem(sku2.value, qty2.value, price2.value);
      await repos.orders.save(order2);

      // Update first order
      const findResult = await repos.orders.findById('uow-multi-1');
      if (!findResult.success || !findResult.value) {
        return fail('Failed to find order');
      }

      const foundOrder = findResult.value;
      const confirmResult = foundOrder.confirm();
      if (!confirmResult.success) return fail(confirmResult.error);

      await repos.orders.update(foundOrder);

      return ok({ order1: order1.id, order2: order2.id });
    });

    expect(result.success).toBe(true);

    // Verify both orders were saved
    const order1Check = await pool.query('SELECT * FROM orders WHERE id = $1', ['uow-multi-1']);
    expect(order1Check.rows.length).toBe(1);
    expect(order1Check.rows[0].status).toBe('CONFIRMED');

    const order2Check = await pool.query('SELECT * FROM orders WHERE id = $1', ['uow-multi-2']);
    expect(order2Check.rows.length).toBe(1);
    expect(order2Check.rows[0].status).toBe('DRAFT');

    // Verify all items were saved
    const itemsCount = await pool.query('SELECT COUNT(*) as count FROM order_items');
    expect(parseInt(itemsCount.rows[0].count)).toBe(2);
  });

  it('should isolate transactions from each other', async () => {
    if (config.USE_INMEMORY) return;

    // First transaction - commits
    const result1 = await unitOfWork.run(async (repos) => {
      const currencyResult = Currency.create('EUR');
      if (!currencyResult.success) return fail(currencyResult.error);

      const orderResult = Order.create('uow-isolated-1', currencyResult.value);
      if (!orderResult.success) return fail(orderResult.error);

      const order = orderResult.value;

      const sku = SKU.create('ISOLATED-1');
      const qty = Quantity.create(1);
      const price = Money.create(20.00, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) {
        return fail('Failed to create value objects');
      }

      order.addItem(sku.value, qty.value, price.value);
      await repos.orders.save(order);

      return ok(undefined);
    });

    expect(result1.success).toBe(true);

    // Second transaction - rolls back
    const result2 = await unitOfWork.run(async (repos) => {
      const currencyResult = Currency.create('EUR');
      if (!currencyResult.success) return fail(currencyResult.error);

      const orderResult = Order.create('uow-isolated-2', currencyResult.value);
      if (!orderResult.success) return fail(orderResult.error);

      const order = orderResult.value;

      const sku = SKU.create('ISOLATED-2');
      const qty = Quantity.create(1);
      const price = Money.create(30.00, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) {
        return fail('Failed to create value objects');
      }

      order.addItem(sku.value, qty.value, price.value);
      await repos.orders.save(order);

      return fail('Transaction 2 failed');
    });

    expect(result2.success).toBe(false);

    // Verify only first order exists
    const allOrders = await pool.query('SELECT id FROM orders ORDER BY id');
    expect(allOrders.rows.length).toBe(1);
    expect(allOrders.rows[0].id).toBe('uow-isolated-1');
  });

  it('should provide access to repository methods within transaction', async () => {
    if (config.USE_INMEMORY) return;

    const result = await unitOfWork.run(async (repos) => {
      const currencyResult = Currency.create('USD');
      if (!currencyResult.success) return fail(currencyResult.error);

      // Test save
      const orderResult = Order.create('uow-repo-test', currencyResult.value);
      if (!orderResult.success) return fail(orderResult.error);

      const order = orderResult.value;

      const sku = SKU.create('REPO-ITEM');
      const qty = Quantity.create(5);
      const price = Money.create(12.50, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) {
        return fail('Failed to create value objects');
      }

      order.addItem(sku.value, qty.value, price.value);
      await repos.orders.save(order);

      // Test findById
      const findResult = await repos.orders.findById('uow-repo-test');
      if (!findResult.success) return fail(findResult.error);
      if (!findResult.value) return fail('Order not found');

      expect(findResult.value.id).toBe('uow-repo-test');
      expect(findResult.value.getItems().length).toBe(1);

      // Test update
      const updateResult = await repos.orders.update(findResult.value);
      if (!updateResult.success) return fail(updateResult.error);

      // Test findAll
      const allResult = await repos.orders.findAll();
      if (!allResult.success) return fail(allResult.error);
      expect(allResult.value.length).toBe(1);

      return ok('All repository methods work');
    });

    expect(result.success).toBe(true);
  });
});
