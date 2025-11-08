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

/**
 * Interfaz de dependencias que agrupa puertos y use cases
 * Extiende ServerDependencies con los use cases
 */
export interface Dependencies extends ServerDependencies {
  // Ports
  orderRepository: OrderRepository;
  pricingService: PricingService;
  eventBus: EventBus;
  
  // Use Cases
  createOrderUseCase: CreateOrderUseCase;
  addItemToOrderUseCase: AddItemToOrderUseCase;
}

/**
 * Construir el contenedor de dependencias completo
 * Factory function que crea e inyecta todas las dependencias
 */
export function buildContainer(): Dependencies {
  // Infrastructure layer - Adapters
  const orderRepository = new InMemoryOrderRepository();
  const pricingService = new StaticPricingService();
  const eventBus = new InMemoryEventBus();
  const clock = new SystemClock();

  // Application layer - Use Cases
  const createOrderUseCase = new CreateOrderUseCase(orderRepository, eventBus);
  const addItemToOrderUseCase = new AddItemToOrderUseCase(
    orderRepository,
    pricingService,
    eventBus
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
  };
}
