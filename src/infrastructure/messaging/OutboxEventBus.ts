import pg from 'pg';
import { ok, fail } from '../../shared/result.js';
import type { Result } from '../../shared/result.js';
import type { EventBus } from '../../application/ports/EventBus.js';
import type { DomainEvent } from '../../domain/events/index.js';

/**
 * EventBus implementation using Transactional Outbox Pattern
 * Persists events to database for reliable publishing
 * Events are published asynchronously by OutboxDispatcher
 * Must receive a transactional client to ensure atomicity
 */
export class OutboxEventBus implements EventBus {
  private client: pg.PoolClient;
  private handlers: Map<string, Array<(event: DomainEvent) => Promise<void>>> = new Map();

  constructor(client: pg.PoolClient) {
    this.client = client;
  }

  /**
   * Publish multiple events to outbox table
   * Uses the transactional client provided in constructor
   */
  async publish(events: DomainEvent[]): Promise<Result<void, string>> {
    if (events.length === 0) {
      return ok(undefined);
    }

    try {
      // Prepare data arrays for batch insert
      const aggregateIds = events.map(e => e.aggregateId);
      const aggregateTypes = events.map(e => this.extractAggregateType(e));
      const eventTypes = events.map(e => e.eventType);
      const eventDataArray = events.map(e => JSON.stringify(e));
      const timestamps = events.map(e => e.timestamp);

      // Single INSERT with unnest for batch operation
      await this.client.query(
        `INSERT INTO outbox (aggregate_id, aggregate_type, event_type, event_data, created_at)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::jsonb[], $5::timestamptz[])`,
        [aggregateIds, aggregateTypes, eventTypes, eventDataArray, timestamps]
      );

      return ok(undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return fail(`Failed to publish events to outbox: ${message}`);
    }
  }

  /**
   * Publish a single event to outbox table
   */
  async publishSingle(event: DomainEvent): Promise<Result<void, string>> {
    return this.publish([event]);
  }

  /**
   * Subscribe to events (for in-memory handlers)
   * Note: This is for local event handling, not for outbox processing
   */
  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Extract aggregate type from event type
   * e.g., "OrderCreated" -> "Order"
   */
  private extractAggregateType(event: DomainEvent): string {
    // Try to extract from event type (e.g., "OrderCreated" -> "Order")
    const match = event.eventType.match(/^([A-Z][a-z]+)/);
    return match ? match[1] : 'Unknown';
  }

}
