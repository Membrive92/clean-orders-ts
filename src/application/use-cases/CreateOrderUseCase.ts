import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';
import { Order } from '../../domain/entities/Order.js';
import { Currency } from '../../domain/value-objects/Currency.js';
import { ValidationError, ConflictError, InfraError, AppError } from '../errors/index.js';
import type { CreateOrderDTO } from '../dtos/CreateOrderDTO.js';
import type { OrderRepository } from '../ports/OrderRepository.js';
import type { EventBus } from '../ports/EventBus.js';

/**
 * Use case para crear una nueva orden
 * Implementa la orquestación entre dominio e infraestructura
 */
export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private eventBus: EventBus
  ) {}

  async execute(dto: CreateOrderDTO): Promise<Result<{ orderId: string }, AppError>> {
    try {
      // 1. Validar el DTO
      if (!dto.orderId || dto.orderId.trim().length === 0) {
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
        const conflictError = new ConflictError(`Orden con ID ${dto.orderId} ya existe`);
        return fail(new AppError(conflictError));
      }

      // 4. Crear la orden en el dominio
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
        const publishResult = await this.eventBus.publish(events);
        if (!publishResult.success) {
          const infraError = new InfraError(publishResult.error);
          return fail(new AppError(infraError));
        }
      }

      // 7. Clear order events after publishing
      order.clearDomainEvents();

      return ok({ orderId: order.id });
    } catch (error) {
      const infraError = new InfraError(
        error instanceof Error ? error.message : 'Unknown error while creating order'
      );
      return fail(new AppError(infraError));
    }
  }
}
