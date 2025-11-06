import type { OrderRepository } from './OrderRepository.js';
import type { PricingService } from './PricingService.js';
import type { EventBus } from './EventBus.js';
import type { Clock } from './Clock.js';

/**
 * Agrupa todas las dependencias que necesita el servidor/aplicación
 * Facilita la inyección de dependencias y composición
 */
export interface ServerDependencies {
  orderRepository: OrderRepository;
  pricingService: PricingService;
  eventBus: EventBus;
  clock: Clock;
}
