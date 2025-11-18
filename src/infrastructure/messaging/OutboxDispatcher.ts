import pg from 'pg';
import pino from 'pino';
import { config } from '../../composition/config.js';

const { Pool } = pg;

interface OutboxRecord {
  id: number;
  aggregate_id: string;
  aggregate_type: string;
  event_type: string;
  event_data: any;
  created_at: Date;
  published_at: Date | null;
}

/**
 * Outbox Dispatcher
 * Polls the outbox table for unpublished events and publishes them
 * Uses FOR UPDATE SKIP LOCKED to handle concurrent workers
 */
export class OutboxDispatcher {
  private pool: pg.Pool;
  private logger: pino.Logger;
  private isRunning = false;
  private pollIntervalMs: number;
  private batchSize: number;

  constructor(
    connectionString: string,
    pollIntervalMs: number = 5000,
    batchSize: number = 100
  ) {
    this.pool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.logger = pino({
      level: config.LOG_LEVEL,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });

    this.pollIntervalMs = pollIntervalMs;
    this.batchSize = batchSize;
  }

  /**
   * Start the dispatcher
   * Polls the outbox table at regular intervals
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Dispatcher already running');
      return;
    }

    this.isRunning = true;
    this.logger.info({
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
    }, 'Starting Outbox Dispatcher');

    // Run initial poll
    await this.poll();

    // Schedule subsequent polls
    this.schedulePoll();
  }

  /**
   * Stop the dispatcher
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping Outbox Dispatcher');
    this.isRunning = false;
    await this.pool.end();
  }

  /**
   * Schedule next poll
   */
  private schedulePoll(): void {
    if (!this.isRunning) return;

    setTimeout(async () => {
      try {
        await this.poll();
      } catch (error) {
        this.logger.error({ error }, 'Error during poll');
      }
      this.schedulePoll();
    }, this.pollIntervalMs);
  }

  /**
   * Poll for unpublished events and publish them
   */
  private async poll(): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Select unpublished events with FOR UPDATE SKIP LOCKED
      // This ensures concurrent workers don't process the same events
      const result = await client.query<OutboxRecord>(
        `SELECT id, aggregate_id, aggregate_type, event_type, event_data, created_at, published_at
         FROM outbox
         WHERE published_at IS NULL
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [this.batchSize]
      );

      if (result.rows.length === 0) {
        await client.query('COMMIT');
        this.logger.debug('No unpublished events found');
        return;
      }

      this.logger.info(`Processing ${result.rows.length} unpublished events`);

      // Publish all events in parallel
      const publishResults = await Promise.allSettled(
        result.rows.map(record => this.publishEvent(record))
      );

      // Collect IDs of successfully published events
      const publishedIds: number[] = [];
      const events = result.rows;
      
      publishResults.forEach((publishResult, index) => {
        const record = events[index];
        if (publishResult.status === 'fulfilled') {
          publishedIds.push(record.id);
          this.logger.info(
            {
              eventId: record.id,
              eventType: record.event_type,
              aggregateId: record.aggregate_id,
            },
            'Event published successfully'
          );
        } else {
          this.logger.error(
            {
              error: publishResult.reason,
              eventId: record.id,
              eventType: record.event_type,
            },
            'Failed to publish event'
          );
        }
      });

      // Mark all successfully published events in a single query
      if (publishedIds.length > 0) {
        await client.query(
          'UPDATE outbox SET published_at = NOW() WHERE id = ANY($1)',
          [publishedIds]
        );
        this.logger.info(`Marked ${publishedIds.length} events as published`);
      }

      await client.query('COMMIT');

      this.logger.info(`Batch completed: ${result.rows.length} events processed`);
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error({ error }, 'Error processing outbox batch');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Publish an event to external systems
   * In a real system, this would send to a message broker (RabbitMQ, Kafka, etc.)
   */
  private async publishEvent(record: OutboxRecord): Promise<void> {
    // TODO: Implement actual event publishing to message broker
    // For now, just log the event
    this.logger.info(
      {
        eventId: record.id,
        eventType: record.event_type,
        aggregateType: record.aggregate_type,
        aggregateId: record.aggregate_id,
        eventData: record.event_data,
      },
      'Publishing event (mock)'
    );

    // Simulate async publishing
    await new Promise((resolve) => setTimeout(resolve, 10));

    // In production, you would:
    // 1. Send to message broker (RabbitMQ, Kafka, etc.)
    // 2. Send to webhook endpoints
    // 3. Trigger integrations
    // Example:
    // await this.messageBroker.publish(record.event_type, record.event_data);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error({ error }, 'Health check failed');
      return false;
    }
  }

  /**
   * Get statistics about the outbox
   */
  async getStats(): Promise<{
    unpublished: number;
    published: number;
    oldestUnpublished: Date | null;
  }> {
    const client = await this.pool.connect();

    try {
      const unpublishedResult = await client.query(
        'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NULL'
      );

      const publishedResult = await client.query(
        'SELECT COUNT(*) as count FROM outbox WHERE published_at IS NOT NULL'
      );

      const oldestResult = await client.query(
        'SELECT created_at FROM outbox WHERE published_at IS NULL ORDER BY created_at ASC LIMIT 1'
      );

      return {
        unpublished: parseInt(unpublishedResult.rows[0].count),
        published: parseInt(publishedResult.rows[0].count),
        oldestUnpublished: oldestResult.rows[0]?.created_at || null,
      };
    } finally {
      client.release();
    }
  }
}

// Main execution if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const dispatcher = new OutboxDispatcher(
    config.DATABASE_URL,
    5000, // Poll every 5 seconds
    100   // Process up to 100 events per batch
  );

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down gracefully...');
    await dispatcher.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the dispatcher
  dispatcher.start().catch((error) => {
    console.error('Failed to start dispatcher:', error);
    process.exit(1);
  });
}
