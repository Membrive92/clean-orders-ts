import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { OutboxEventBus } from '../../../src/infrastructure/messaging/OutboxEventBus.js';
import { OutboxDispatcher } from '../../../src/infrastructure/messaging/OutboxDispatcher.js';
import { config } from '../../../src/composition/config.js';
import type { DomainEvent } from '../../../src/domain/events/DomainEvent.js';
import pg from 'pg';

const { Pool } = pg;

// Mock domain event
class TestEvent implements DomainEvent {
  constructor(
    public aggregateId: string,
    public eventType: string,
    public timestamp: Date,
    public data: any
  ) {}
}

describe('Outbox Pattern - Integration Tests', () => {
  let dispatcher: OutboxDispatcher;
  let pool: pg.Pool;

  beforeAll(async () => {
    if (config.USE_INMEMORY) {
      console.log('⚠️  Skipping Outbox integration tests (USE_INMEMORY=true)');
      return;
    }

    dispatcher = new OutboxDispatcher(config.DATABASE_URL, 1000, 10);
    pool = new Pool({ connectionString: config.DATABASE_URL });

    // Test connection
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      throw new Error(`Database not available: ${error}`);
    }
  });

  afterAll(async () => {
    if (config.USE_INMEMORY) return;

    await dispatcher.stop();
    await pool.end();
  });

  beforeEach(async () => {
    if (config.USE_INMEMORY) return;

    // Clean up outbox table
    await pool.query('DELETE FROM outbox');
  });

  it('should persist event to outbox table', async () => {
    if (config.USE_INMEMORY) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const eventBus = new OutboxEventBus(client);
      const event = new TestEvent('order-123', 'OrderCreated', new Date(), {
        orderId: 'order-123',
        currency: 'USD',
      });

      const result = await eventBus.publishSingle(event);
      expect(result.success).toBe(true);

      await client.query('COMMIT');

      // Verify event is in outbox
      const rows = await pool.query('SELECT * FROM outbox WHERE aggregate_id = $1', [
        'order-123',
      ]);

      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].event_type).toBe('OrderCreated');
      expect(rows.rows[0].aggregate_type).toBe('Test');
      expect(rows.rows[0].published_at).toBeNull();
    } finally {
      client.release();
    }
  });

  it('should persist multiple events', async () => {
    if (config.USE_INMEMORY) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const eventBus = new OutboxEventBus(client);
      const events = [
        new TestEvent('order-1', 'OrderCreated', new Date(), { orderId: 'order-1' }),
        new TestEvent('order-1', 'ItemAdded', new Date(), { sku: 'ITEM-A' }),
        new TestEvent('order-1', 'OrderConfirmed', new Date(), {}),
      ];

      const result = await eventBus.publish(events);
      expect(result.success).toBe(true);

      await client.query('COMMIT');

      // Verify all events are in outbox
      const rows = await pool.query(
        'SELECT * FROM outbox WHERE aggregate_id = $1 ORDER BY created_at ASC',
        ['order-1']
      );

      expect(rows.rows.length).toBe(3);
      expect(rows.rows[0].event_type).toBe('OrderCreated');
      expect(rows.rows[1].event_type).toBe('ItemAdded');
      expect(rows.rows[2].event_type).toBe('OrderConfirmed');
    } finally {
      client.release();
    }
  });

  it('should handle empty events array', async () => {
    if (config.USE_INMEMORY) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const eventBus = new OutboxEventBus(client);
      const result = await eventBus.publish([]);
      expect(result.success).toBe(true);

      await client.query('COMMIT');

      const rows = await pool.query('SELECT COUNT(*) as count FROM outbox');
      expect(parseInt(rows.rows[0].count)).toBe(0);
    } finally {
      client.release();
    }
  });

  it('should mark events as published after dispatch', async () => {
    if (config.USE_INMEMORY) return;

    // Insert unpublished events
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventBus = new OutboxEventBus(client);
      
      const event1 = new TestEvent('order-abc', 'OrderCreated', new Date(), {});
      const event2 = new TestEvent('order-xyz', 'OrderCreated', new Date(), {});

      await eventBus.publishSingle(event1);
      await eventBus.publishSingle(event2);
      
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify both are unpublished
    const unpublished1 = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NULL'
    );
    expect(parseInt(unpublished1.rows[0].count)).toBe(2);

    // Run dispatcher manually (single poll)
    await (dispatcher as any).poll();

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify events are now published
    const unpublished2 = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NULL'
    );
    expect(parseInt(unpublished2.rows[0].count)).toBe(0);

    const published = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NOT NULL'
    );
    expect(parseInt(published.rows[0].count)).toBe(2);
  });

  it('should use FOR UPDATE SKIP LOCKED to prevent concurrent processing', async () => {
    if (config.USE_INMEMORY) return;

    // Insert 5 events
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventBus = new OutboxEventBus(client);
      
      for (let i = 1; i <= 5; i++) {
        const event = new TestEvent(`order-${i}`, 'OrderCreated', new Date(), {});
        await eventBus.publishSingle(event);
      }
      
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Simulate concurrent dispatchers by manually locking some rows
    const client1 = await pool.connect();
    const client2 = await pool.connect();

    try {
      await client1.query('BEGIN');
      await client2.query('BEGIN');

      // Client 1 locks first 2 events
      const locked1 = await client1.query(
        `SELECT id FROM outbox 
         WHERE published_at IS NULL 
         ORDER BY created_at ASC 
         LIMIT 2 
         FOR UPDATE SKIP LOCKED`
      );
      expect(locked1.rows.length).toBe(2);

      // Client 2 should skip locked rows and get next 2
      const locked2 = await client2.query(
        `SELECT id FROM outbox 
         WHERE published_at IS NULL 
         ORDER BY created_at ASC 
         LIMIT 2 
         FOR UPDATE SKIP LOCKED`
      );
      expect(locked2.rows.length).toBe(2);

      // Ensure they got different rows
      const ids1 = locked1.rows.map((r) => r.id);
      const ids2 = locked2.rows.map((r) => r.id);
      
      const intersection = ids1.filter((id) => ids2.includes(id));
      expect(intersection.length).toBe(0); // No overlap

      await client1.query('COMMIT');
      await client2.query('COMMIT');
    } finally {
      client1.release();
      client2.release();
    }
  });

  it('should process events in order (FIFO)', async () => {
    if (config.USE_INMEMORY) return;

    const processedOrder: string[] = [];

    // Insert events with delays to ensure order
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventBus = new OutboxEventBus(client);
      
      for (let i = 1; i <= 3; i++) {
        const event = new TestEvent(`order-${i}`, `Event${i}`, new Date(), {});
        await eventBus.publishSingle(event);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Get events in order
    const rows = await pool.query(
      'SELECT event_type FROM outbox ORDER BY created_at ASC'
    );

    expect(rows.rows[0].event_type).toBe('Event1');
    expect(rows.rows[1].event_type).toBe('Event2');
    expect(rows.rows[2].event_type).toBe('Event3');
  });

  it('should get outbox statistics', async () => {
    if (config.USE_INMEMORY) return;

    // Insert some events
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventBus = new OutboxEventBus(client);
      
      await eventBus.publishSingle(
        new TestEvent('order-1', 'Event1', new Date(), {})
      );
      await eventBus.publishSingle(
        new TestEvent('order-2', 'Event2', new Date(), {})
      );
      
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Mark one as published manually
    await pool.query(
      'UPDATE outbox SET published_at = NOW() WHERE aggregate_id = $1',
      ['order-1']
    );

    const stats = await dispatcher.getStats();

    expect(stats.unpublished).toBe(1);
    expect(stats.published).toBe(1);
    expect(stats.oldestUnpublished).not.toBeNull();
  });

  it('should handle dispatcher health check', async () => {
    if (config.USE_INMEMORY) return;

    const healthy = await dispatcher.healthCheck();
    expect(healthy).toBe(true);
  });

  it('should respect batch size limit', async () => {
    if (config.USE_INMEMORY) return;

    // Create dispatcher with batch size of 3
    const smallDispatcher = new OutboxDispatcher(config.DATABASE_URL, 1000, 3);

    // Insert 10 events
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const eventBus = new OutboxEventBus(client);
      
      for (let i = 1; i <= 10; i++) {
        await eventBus.publishSingle(
          new TestEvent(`order-${i}`, 'OrderCreated', new Date(), {})
        );
      }
      
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Process one batch
    await (smallDispatcher as any).poll();
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should have processed only 3 (batch size)
    const published = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NOT NULL'
    );
    expect(parseInt(published.rows[0].count)).toBe(3);

    const unpublished = await pool.query(
      'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NULL'
    );
    expect(parseInt(unpublished.rows[0].count)).toBe(7);

    await smallDispatcher.stop();
  });
});
