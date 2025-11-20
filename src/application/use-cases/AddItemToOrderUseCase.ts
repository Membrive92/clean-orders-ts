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
import type { Logger } from '../../infrastructure/loggin/PinoLogger.js';

/**
 * Use case for adding an item to an existing order
 * Validates, gets prices and coordinates with the domain
 */
export class AddItemToOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,
    private pricingService: PricingService,
    private eventBus: EventBus,
    private logger: Logger
  ) {}

  async execute(dto: AddItemToOrderDTO): Promise<Result<void, AppError>> {
    this.logger.info('Executing AddItemToOrderUseCase', { orderId: dto.orderId, sku: dto.sku, quantity: dto.quantity });

    try {
      // 1. Validate the DTO
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
        this.logger.warn('Order not found', { orderId: dto.orderId });
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
      this.logger.debug('Fetching price from pricing service', { sku: dto.sku, currency: order.currency.toString() });
      const priceResult = await this.pricingService.getPriceForSku(
        skuResult.value.toString(),
        order.currency.toString()
      );
      if (!priceResult.success) {
        const infraError = new InfraError(priceResult.error);
        return fail(new AppError(infraError));
      }

      // 6. Create Money with obtained price
      const moneyResult = Money.create(priceResult.value, order.currency);
      if (!moneyResult.success) {
        const validationError = new ValidationError(moneyResult.error);
        return fail(new AppError(validationError));
      }

      // 7. Add the item to the order (domain validations)
      const addItemResult = order.addItem(skuResult.value, quantityResult.value, moneyResult.value);
      if (!addItemResult.success) {
        // Map domain errors to specific types
        const errorMessage = addItemResult.error;
        this.logger.warn('Domain validation failed when adding item', { orderId: dto.orderId, sku: dto.sku, error: errorMessage });
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
        this.logger.debug('Publishing domain events', { orderId: dto.orderId, eventCount: events.length });
        const publishResult = await this.eventBus.publish(events);
        if (!publishResult.success) {
          const infraError = new InfraError(publishResult.error);
          return fail(new AppError(infraError));
        }
      }

      // 10. Limpiar eventos
      order.clearDomainEvents();

      this.logger.info('Item added to order successfully', { orderId: dto.orderId, sku: dto.sku, quantity: dto.quantity });
      return ok(undefined);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error while adding item');
      this.logger.error('Unexpected error in AddItemToOrderUseCase', err, { orderId: dto.orderId, sku: dto.sku });
      const infraError = new InfraError(err.message);
      return fail(new AppError(infraError));
    }
  }
}
