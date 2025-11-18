import { config } from '../../composition/config.js';
import { OutboxDispatcher } from './OutboxDispatcher.js';
import { InMemoryEventBus } from './InMemoryEventBus.js';
import type { EventBus } from '../../application/ports/EventBus.js';

/**
 * Messaging Factory
 * Creates and manages messaging components (Event Bus, Dispatcher)
 */
export class MessagingFactory {
  private static dispatcher: OutboxDispatcher | null = null;
  private static inMemoryEventBus: InMemoryEventBus | null = null;

  /**
   * Create Event Bus based on configuration
   * Note: OutboxEventBus requires a transactional client, so it's created within UnitOfWork
   * This method only creates the in-memory version for non-transactional use
   */
  static createEventBus(): EventBus {
    if (config.USE_INMEMORY) {
      return this.getInMemoryEventBus();
    }

    throw new Error(
      'OutboxEventBus must be created within a transaction context. Use UnitOfWork.run() instead.'
    );
  }

  /**
   * Get or create in-memory event bus
   */
  static getInMemoryEventBus(): InMemoryEventBus {
    if (!this.inMemoryEventBus) {
      this.inMemoryEventBus = new InMemoryEventBus();
    }

    return this.inMemoryEventBus;
  }

  /**
   * Get or create Outbox Dispatcher
   * @param pollIntervalMs Polling interval in milliseconds (default: 5000)
   * @param batchSize Number of events to process per batch (default: 100)
   */
  static getDispatcher(pollIntervalMs?: number, batchSize?: number): OutboxDispatcher {
    if (!this.dispatcher) {
      this.dispatcher = new OutboxDispatcher(
        config.DATABASE_URL,
        pollIntervalMs,
        batchSize
      );
    }

    return this.dispatcher;
  }

  /**
   * Start the outbox dispatcher
   */
  static async startDispatcher(pollIntervalMs?: number, batchSize?: number): Promise<void> {
    if (config.USE_INMEMORY) {
      console.log('⚠️  Skipping dispatcher start (USE_INMEMORY=true)');
      return;
    }

    const dispatcher = this.getDispatcher(pollIntervalMs, batchSize);
    await dispatcher.start();
    console.log('✅ Outbox Dispatcher started');
  }

  /**
   * Stop the outbox dispatcher
   */
  static async stopDispatcher(): Promise<void> {
    if (this.dispatcher) {
      await this.dispatcher.stop();
      this.dispatcher = null;
      console.log('✅ Outbox Dispatcher stopped');
    }
  }

  /**
   * Get dispatcher statistics
   */
  static async getDispatcherStats(): Promise<{
    unpublished: number;
    published: number;
    oldestUnpublished: Date | null;
  } | null> {
    if (!this.dispatcher) {
      return null;
    }

    return this.dispatcher.getStats();
  }

  /**
   * Check dispatcher health
   */
  static async checkDispatcherHealth(): Promise<boolean> {
    if (!this.dispatcher) {
      return false;
    }

    return this.dispatcher.healthCheck();
  }

  /**
   * Trigger manual dispatch (for testing or manual processing)
   */
  static async manualDispatch(): Promise<void> {
    if (!this.dispatcher) {
      throw new Error('Dispatcher not initialized');
    }

    // Access private poll method for manual triggering
    await (this.dispatcher as any).poll();
  }

  /**
   * Close all messaging resources
   */
  static async close(): Promise<void> {
    console.log('📨 Closing messaging resources...');

    await this.stopDispatcher();

    if (this.inMemoryEventBus) {
      // Clear any pending handlers
      this.inMemoryEventBus = null;
    }

    console.log('✅ Messaging resources closed');
  }

  /**
   * Health check for messaging system
   */
  static async healthCheck(): Promise<{
    dispatcher: boolean;
    eventBus: boolean;
  }> {
    const dispatcherHealthy = this.dispatcher
      ? await this.dispatcher.healthCheck()
      : true; // If not running, consider it healthy

    const eventBusHealthy = config.USE_INMEMORY
      ? true // In-memory is always healthy
      : this.dispatcher !== null; // For outbox, check if dispatcher exists

    return {
      dispatcher: dispatcherHealthy,
      eventBus: eventBusHealthy,
    };
  }
}
