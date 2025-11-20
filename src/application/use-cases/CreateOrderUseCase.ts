import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';
import { Order } from '../../domain/entities/Order.js';
import { Currency } from '../../domain/value-objects/Currency.js';
import { ValidationError, ConflictError, InfraError, AppError } from '../errors/index.js';
import type { CreateOrderDTO } from '../dtos/CreateOrderDTO.js';
import type { OrderRepository } from '../ports/OrderRepository.js';
import type { EventBus } from '../ports/EventBus.js';
import type { Logger } from '../../infrastructure/loggin/PinoLogger.js';

/**
 * Use case to create a new order
 * Implements orchestration between domain and infrastructure
 */
export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Result<{ orderId: string }, AppError>> {
    this.logger.info('Executing CreateOrderUseCase', { orderId: dto.orderId, currency: dto.currency });

    try {
      // 1. Validate the DTO
      if (!dto.orderId || dto.orderId.trim().length === 0) {
        this.logger.warn('Validation failed: orderId is required');
        const validationError = new ValidationError('orderId es requerido');
        return fail(new AppError(validationError));
      }

      if (!dto.currency || dto.currency.trim().length === 0) {
        const validationError = new ValidationError('currency es requerida');
        return fail(new AppError(validationError));
      }

      // 2. Validate that the currency is valid (create value object)
      const currencyResult = Currency.create(dto.currency);
      if (!currencyResult.success) {
        const validationError = new ValidationError(currencyResult.error);
        return fail(new AppError(validationError));
      }

      // 3. Verificar que la orden no existe
      const existingOrder = await this.orderRepository.findById(dto.orderId);
      if (!existingOrder.success) {
        const infraError = new InfraError(existingOrder.error);
        return fail(new AppError(infraError));
      }

      if (existingOrder.value !== null) {
        this.logger.warn('Order already exists', { orderId: dto.orderId });
        const conflictError = new ConflictError(`Orden con ID ${dto.orderId} ya existe`);
        return fail(new AppError(conflictError));
      }

      // 4. Create the order in the domain
      const orderResult = Order.create(dto.orderId, currencyResult.value);
      if (!orderResult.success) {
        const validationError = new ValidationError(orderResult.error);
        return fail(new AppError(validationError));
      }

      const order = orderResult.value;

      // 5. Persistir la orden
      const saveResult = await this.orderRepository.save(order);
      if (!saveResult.success) {
        const infraError = new InfraError(saveResult.error);
        return fail(new AppError(infraError));
      }

      // 6. Publicar eventos de dominio
      const events = order.getDomainEvents();
      if (events.length > 0) {
        this.logger.debug('Publishing domain events', { orderId: dto.orderId, eventCount: events.length });
        const publishResult = await this.eventBus.publish(events);
        if (!publishResult.success) {
          const infraError = new InfraError(publishResult.error);
          return fail(new AppError(infraError));
        }
      }

      // 7. Clear order events after publishing
      order.clearDomainEvents();

      this.logger.info('Order created successfully', { orderId: order.id });
      return ok({ orderId: order.id });
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error while creating order');
      this.logger.error('Unexpected error in CreateOrderUseCase', err, { orderId: dto.orderId });
      const infraError = new InfraError(err.message);
      return fail(new AppError(infraError));
    }
  }
}
