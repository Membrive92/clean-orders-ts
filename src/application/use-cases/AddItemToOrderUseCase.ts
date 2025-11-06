import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';
import { SKU } from '../../domain/value-objects/SKU.js';
import { Quantity } from '../../domain/value-objects/Quantity.js';
import { Money } from '../../domain/value-objects/Money.js';
import { ValidationError, NotFoundError, ConflictError, InfraError, AppError } from '../errors/index.js';
import type { AddItemToOrderDTO } from '../dtos/AddItemToOrderDTO.js';
import type { OrderRepository } from '../ports/OrderRepository.js';
import type { PricingService } from '../ports/PricingService.js';
import type { EventBus } from '../ports/EventBus.js';

/**
 * Use case para agregar un item a una orden existente
 * Valida, obtiene precios y coordina con el dominio
 */
export class AddItemToOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private pricingService: PricingService,
    private eventBus: EventBus
  ) {}

  async execute(dto: AddItemToOrderDTO): Promise<Result<void, AppError>> {
    try {
      // 1. Validar el DTO
      if (!dto.orderId || dto.orderId.trim().length === 0) {
        const validationError = new ValidationError('orderId es requerido');
        return fail(new AppError(validationError));
      }

      if (!dto.sku || dto.sku.trim().length === 0) {
        const validationError = new ValidationError('sku es requerido');
        return fail(new AppError(validationError));
      }

      if (!Number.isInteger(dto.quantity) || dto.quantity <= 0) {
        const validationError = new ValidationError('quantity debe ser un entero positivo');
        return fail(new AppError(validationError));
      }

      // 2. Obtener la orden
      const orderResult = await this.orderRepository.findById(dto.orderId);
      if (!orderResult.success) {
        const infraError = new InfraError(orderResult.error);
        return fail(new AppError(infraError));
      }

      if (orderResult.value === null) {
        const notFoundError = new NotFoundError(`Orden con ID ${dto.orderId} no encontrada`);
        return fail(new AppError(notFoundError));
      }

      const order = orderResult.value;

      // 3. Validar SKU con Value Object
      const skuResult = SKU.create(dto.sku);
      if (!skuResult.success) {
        const validationError = new ValidationError(skuResult.error);
        return fail(new AppError(validationError));
      }

      // 4. Validar cantidad con Value Object
      const quantityResult = Quantity.create(dto.quantity);
      if (!quantityResult.success) {
        const validationError = new ValidationError(quantityResult.error);
        return fail(new AppError(validationError));
      }

      // 5. Obtener precio del servicio de precios
      const priceResult = await this.pricingService.getPriceForSku(
        skuResult.value.toString(),
        order.currency.toString()
      );
      if (!priceResult.success) {
        const infraError = new InfraError(priceResult.error);
        return fail(new AppError(infraError));
      }

      // 6. Crear Money con el precio obtenido
      const moneyResult = Money.create(priceResult.value, order.currency);
      if (!moneyResult.success) {
        const validationError = new ValidationError(moneyResult.error);
        return fail(new AppError(validationError));
      }

      // 7. Agregar el item a la orden (validaciones del dominio)
      const addItemResult = order.addItem(skuResult.value, quantityResult.value, moneyResult.value);
      if (!addItemResult.success) {
        // Mapear errores del dominio a tipos específicos
        const errorMessage = addItemResult.error;
        if (errorMessage.includes('estado')) {
          const conflictError = new ConflictError(errorMessage);
          return fail(new AppError(conflictError));
        }
        if (errorMessage.includes('ya existe')) {
          const conflictError = new ConflictError(errorMessage);
          return fail(new AppError(conflictError));
        }
        const validationError = new ValidationError(errorMessage);
        return fail(new AppError(validationError));
      }

      // 8. Persistir la orden actualizada
      const updateResult = await this.orderRepository.update(order);
      if (!updateResult.success) {
        const infraError = new InfraError(updateResult.error);
        return fail(new AppError(infraError));
      }

      // 9. Publicar eventos de dominio
      const events = order.getDomainEvents();
      if (events.length > 0) {
        const publishResult = await this.eventBus.publish(events);
        if (!publishResult.success) {
          const infraError = new InfraError(publishResult.error);
          return fail(new AppError(infraError));
        }
      }

      // 10. Limpiar eventos
      order.clearDomainEvents();

      return ok(undefined);
    } catch (error) {
      const infraError = new InfraError(
        error instanceof Error ? error.message : 'Error desconocido al agregar item'
      );
      return fail(new AppError(infraError));
    }
  }
}
