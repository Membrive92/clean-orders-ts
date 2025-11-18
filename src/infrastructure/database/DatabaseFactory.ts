import pg from 'pg';
import { config } from '../../composition/config.js';
import { PostgresOrderRepository } from '../postgres/PostgresOrderRepository.js';
import { PostgresUnitOfWork } from '../postgres/PostgresUnitOfWork.js';

const { Pool } = pg;

/**
 * Database Factory
 * Creates and manages database connections and repositories
 */
export class DatabaseFactory {
  private static pool: pg.Pool | null = null;
  private static unitOfWork: PostgresUnitOfWork | null = null;

  /**
   * Get or create PostgreSQL connection pool
   */
  static getPool(): pg.Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: config.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        console.error('Unexpected error on idle client', err);
      });
    }

    return this.pool;
  }

  /**
   * Create PostgreSQL Order Repository
   */
  static createOrderRepository(): PostgresOrderRepository {
    return new PostgresOrderRepository(config.DATABASE_URL);
  }

  /**
   * Get or create Unit of Work
   */
  static getUnitOfWork(): PostgresUnitOfWork {
    if (!this.unitOfWork) {
      this.unitOfWork = new PostgresUnitOfWork(config.DATABASE_URL);
    }

    return this.unitOfWork;
  }

  /**
   * Test database connection
   */
  static async testConnection(): Promise<boolean> {
    try {
      const pool = this.getPool();
      await pool.query('SELECT NOW()');
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Run database migrations
   */
  static async runMigrations(): Promise<void> {
    const { readdir, readFile } = await import('fs/promises');
    const { join } = await import('path');
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      console.log('🚀 Running database migrations...');

      // Get migration files
      const migrationsDir = join(process.cwd(), 'db', 'migrations');
      const files = await readdir(migrationsDir);
      const sqlFiles = files
        .filter((f) => f.endsWith('.sql'))
        .sort();

      if (sqlFiles.length === 0) {
        console.log('⚠️  No migration files found');
        return;
      }

      // Execute each migration
      for (const file of sqlFiles) {
        const filePath = join(migrationsDir, file);
        const sql = await readFile(filePath, 'utf-8');
        
        console.log(`📄 Executing ${file}...`);
        await client.query(sql);
        console.log(`✅ ${file} completed`);
      }

      console.log(`✅ All migrations completed (${sqlFiles.length} files)`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Seed database with test data
   */
  static async seedDatabase(): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log('🌱 Seeding database...');

      // Clean existing data
      await client.query('DELETE FROM order_items');
      await client.query('DELETE FROM orders');
      await client.query('DELETE FROM outbox');

      // Seed orders
      const orders = [
        { id: 'order-001', currency: 'USD', status: 'DRAFT' },
        { id: 'order-002', currency: 'EUR', status: 'CONFIRMED' },
        { id: 'order-003', currency: 'MXN', status: 'FINALIZED' },
      ];

      for (const order of orders) {
        await client.query(
          'INSERT INTO orders (id, currency, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW())',
          [order.id, order.currency, order.status]
        );
      }

      // Seed order items
      const items = [
        { order_id: 'order-001', sku: 'LAPTOP-001', quantity: 1, price: 999.99, currency: 'USD' },
        { order_id: 'order-001', sku: 'MOUSE-001', quantity: 2, price: 29.99, currency: 'USD' },
        { order_id: 'order-002', sku: 'KEYBOARD-001', quantity: 1, price: 79.99, currency: 'EUR' },
        { order_id: 'order-003', sku: 'MONITOR-001', quantity: 1, price: 299.99, currency: 'MXN' },
      ];

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, sku, quantity, unit_price_amount, unit_price_currency, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [item.order_id, item.sku, item.quantity, item.price, item.currency]
        );
      }

      await client.query('COMMIT');

      console.log('✅ Database seeded successfully');
      console.log(`   - ${orders.length} orders created`);
      console.log(`   - ${items.length} order items created`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Seeding failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear all data from database
   */
  static async clearDatabase(): Promise<void> {
    const pool = this.getPool();
    const client = await pool.connect();

    try {
      console.log('🧹 Clearing database...');

      await client.query('DELETE FROM order_items');
      await client.query('DELETE FROM orders');
      await client.query('DELETE FROM outbox');

      console.log('✅ Database cleared');
    } catch (error) {
      console.error('❌ Clear failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database statistics
   */
  static async getDatabaseStats(): Promise<{
    orders: number;
    orderItems: number;
    outbox: number;
    outboxUnpublished: number;
  }> {
    const pool = this.getPool();

    const ordersResult = await pool.query('SELECT COUNT(*) as count FROM orders');
    const itemsResult = await pool.query('SELECT COUNT(*) as count FROM order_items');
    const outboxResult = await pool.query('SELECT COUNT(*) as count FROM outbox');
    const unpublishedResult = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NULL'
    );

    return {
      orders: parseInt(ordersResult.rows[0].count),
      orderItems: parseInt(itemsResult.rows[0].count),
      outbox: parseInt(outboxResult.rows[0].count),
      outboxUnpublished: parseInt(unpublishedResult.rows[0].count),
    };
  }

  /**
   * Close all database connections
   */
  static async close(): Promise<void> {
    console.log('🔌 Closing database connections...');

    if (this.unitOfWork) {
      await this.unitOfWork.close();
      this.unitOfWork = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    console.log('✅ Database connections closed');
  }

  /**
   * Health check for database
   */
  static async healthCheck(): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const start = Date.now();

    try {
      const pool = this.getPool();
      await pool.query('SELECT 1');
      const responseTime = Date.now() - start;

      return {
        healthy: true,
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        healthy: false,
        responseTime,
        error: message,
      };
    }
  }
}
