import type { ServerDependencies } from '../application/ports/ServerDependencies.js';
import type { OrderRepository } from '../application/ports/OrderRepository.js';
import type { PricingService } from '../application/ports/PricingService.js';
import type { EventBus } from '../application/ports/EventBus.js';
import { InMemoryOrderRepository } from '../infrastructure/persistence/in-memory/InMemoryOrderRepository.js';
import { StaticPricingService } from '../infrastructure/http/StaticPricingService.js';
import { InMemoryEventBus } from '../infrastructure/messaging/InMemoryEventBus.js';
import { SystemClock } from '../infrastructure/adapters/SystemClock.js';
import { CreateOrderUseCase } from '../application/use-cases/CreateOrderUseCase.js';
import { AddItemToOrderUseCase } from '../application/use-cases/AddItemToOrderUseCase.js';
import { PinoLogger } from '../infrastructure/loggin/PinoLogger.js';
import { DatabaseFactory } from '../infrastructure/database/DatabaseFactory.js';
import { MessagingFactory } from '../infrastructure/messaging/MessagingFactory.js';
import { config } from './config.js';

/**
 * Dependencies interface that groups ports and use cases
 * Extends ServerDependencies with use cases
 */
export interface Dependencies extends ServerDependencies {
  // Ports
  orderRepository: OrderRepository;
  pricingService: PricingService;
  eventBus: EventBus;
  
  // Use Cases
  createOrderUseCase: CreateOrderUseCase;
  addItemToOrderUseCase: AddItemToOrderUseCase;

  // Cleanup
  cleanup: () => Promise<void>;
}

/**
 * Build complete dependency container
 * Factory function that creates and injects all dependencies
 * Switches between in-memory and PostgreSQL based on configuration
 */
export function buildContainer(): Dependencies {
  const logger = new PinoLogger({ name: 'container' });
  
  let orderRepository: OrderRepository;
  let eventBus: EventBus;
  let cleanup: () => Promise<void>;

  if (config.USE_INMEMORY) {
    // In-Memory mode for testing
    logger.info('Using in-memory implementations');
    
    orderRepository = new InMemoryOrderRepository();
    eventBus = new InMemoryEventBus();
    
    cleanup = async () => {
      logger.info('Cleanup: in-memory mode (no-op)');
    };
  } else {
    // PostgreSQL mode for production
    logger.info('Using PostgreSQL implementations', { databaseUrl: config.DATABASE_URL });
    
    orderRepository = DatabaseFactory.createOrderRepository();
    eventBus = MessagingFactory.getInMemoryEventBus(); // Using in-memory for now, can switch to OutboxEventBus with UnitOfWork
    
    cleanup = async () => {
      logger.info('Cleanup: closing PostgreSQL connections and messaging resources');
      await MessagingFactory.close();
      await DatabaseFactory.close();
      logger.info('Cleanup completed');
    };
  }

  // Common infrastructure
  const pricingService = new StaticPricingService();
  const clock = new SystemClock();

  // Logging
  const createOrderLogger = new PinoLogger({ name: 'create-order-use-case' });
  const addItemLogger = new PinoLogger({ name: 'add-item-use-case' });

  // Application layer - Use Cases
  const createOrderUseCase = new CreateOrderUseCase(orderRepository, eventBus, createOrderLogger);
  const addItemToOrderUseCase = new AddItemToOrderUseCase(
    orderRepository,
    pricingService,
    eventBus,
    addItemLogger
  );

  return {
    // Ports
    orderRepository,
    pricingService,
    eventBus,
    clock,
    
    // Use Cases
    createOrderUseCase,
    addItemToOrderUseCase,

    // Cleanup
    cleanup,
  };
}
