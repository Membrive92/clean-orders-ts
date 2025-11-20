import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ValidationError, NotFoundError, ConflictError, InfraError, AppError } from '../../../application/errors/index.js';
import type { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase.js';
import type { AddItemToOrderUseCase } from '../../../application/use-cases/AddItemToOrderUseCase.js';
import type { CreateOrderDTO } from '../../../application/dtos/CreateOrderDTO.js';
import type { AddItemToOrderDTO } from '../../../application/dtos/AddItemToOrderDTO.js';
import type { Logger } from '../../loggin/PinoLogger.js';

/**
 * Order controller for Fastify
 * Exposes HTTP endpoints for creating orders and adding items
 */
export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private addItemToOrderUseCase: AddItemToOrderUseCase,
    private logger: Logger
  ) {}

  /**
   * POST /orders
   * Crear una nueva orden
   */
  async createOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { orderId, currency } = request.body as CreateOrderDTO;

    this.logger.info('Creating order', { orderId, currency });

    try {
      // Validar datos de entrada
      if (!orderId || !currency) {
        this.logger.warn('Validation failed: missing required fields', { orderId, currency });
        reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: 'orderId y currency son requeridos',
        });
        return;
      }

      // Ejecutar use case
      const result = await this.createOrderUseCase.execute({ orderId, currency });

      if (!result.success) {
        const error = result.error;
        const errorType = this.getErrorType(error);
        const statusCode = this.getStatusCode(errorType);

        this.logger.error('Failed to create order', error.type as Error, {
          orderId,
          currency,
          errorType,
          errorMessage: error.message,
        });

        reply.code(statusCode).send({
          error: errorType,
          message: error.message,
        });
        return;
      }

      this.logger.info('Order created successfully', { orderId });

      reply.code(201).send({
        success: true,
        data: result.value,
      });
    } catch (error) {
      this.handleUnexpectedError(error, reply, { orderId, currency });
    }
  }

  /**
   * POST /orders/:orderId/items
   * Add an item to an existing order
   */
  async addItemToOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { orderId } = request.params as { orderId: string };
    const { sku, quantity } = request.body as Omit<AddItemToOrderDTO, 'orderId'>;

    this.logger.info('Adding item to order', { orderId, sku, quantity });

    try {
      // Validar datos de entrada
      if (!orderId || !sku || quantity === undefined) {
        this.logger.warn('Validation failed: missing required fields', { orderId, sku, quantity });
        reply.code(400).send({
          error: 'VALIDATION_ERROR',
          message: 'orderId, sku y quantity son requeridos',
        });
        return;
      }

      // Ejecutar use case
      const result = await this.addItemToOrderUseCase.execute({
        orderId,
        sku,
        quantity,
      });

      if (!result.success) {
        const error = result.error;
        const errorType = this.getErrorType(error);
        const statusCode = this.getStatusCode(errorType);

        this.logger.error('Failed to add item to order', error.type as Error, {
          orderId,
          sku,
          quantity,
          errorType,
          errorMessage: error.message,
        });

        reply.code(statusCode).send({
          error: errorType,
          message: error.message,
        });
        return;
      }

      this.logger.info('Item added to order successfully', { orderId, sku, quantity });

      reply.code(200).send({
        success: true,
        message: 'Item agregado a la orden',
      });
    } catch (error) {
      this.handleUnexpectedError(error, reply, { orderId, sku, quantity });
    }
  }

  /**
   * Registrar las rutas en la instancia de Fastify
   */
  static registerRoutes(
    fastify: FastifyInstance,
    createOrderUseCase: CreateOrderUseCase,
    addItemToOrderUseCase: AddItemToOrderUseCase,
    logger: Logger
  ): void {
    const controller = new OrderController(createOrderUseCase, addItemToOrderUseCase, logger);

    fastify.post('/orders', async (request, reply) => {
      await controller.createOrder(request, reply);
    });

    fastify.post('/orders/:orderId/items', async (request, reply) => {
      await controller.addItemToOrder(request, reply);
    });
  }

  /**
   * Determinar el tipo de error basado en la instancia
   */
  private getErrorType(error: AppError): string {
    if (error.type instanceof ValidationError) {
      return 'VALIDATION_ERROR';
    }
    if (error.type instanceof NotFoundError) {
      return 'NOT_FOUND_ERROR';
    }
    if (error.type instanceof ConflictError) {
      return 'CONFLICT_ERROR';
    }
    if (error.type instanceof InfraError) {
      return 'INFRA_ERROR';
    }
    return 'INTERNAL_SERVER_ERROR';
  }

  /**
   * Mapear tipo de error a código HTTP
   */
  private getStatusCode(errorType: string): number {
    switch (errorType) {
      case 'VALIDATION_ERROR':
        return 400;
      case 'NOT_FOUND_ERROR':
        return 404;
      case 'CONFLICT_ERROR':
        return 409;
      case 'INFRA_ERROR':
        return 500;
      default:
        return 500;
    }
  }

  /**
   * Manejar errores inesperados
   */
  private handleUnexpectedError(error: unknown, reply: FastifyReply, context?: Record<string, unknown>): void {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    const err = error instanceof Error ? error : new Error(message);

    this.logger.error('Unexpected error in controller', err, context);

    reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message,
    });
  }
}
