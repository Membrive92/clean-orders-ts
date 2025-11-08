import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ValidationError, NotFoundError, ConflictError, InfraError, AppError } from '../../../application/errors/index.js';
import type { CreateOrderUseCase } from '../../../application/use-cases/CreateOrderUseCase.js';
import type { AddItemToOrderUseCase } from '../../../application/use-cases/AddItemToOrderUseCase.js';
import type { CreateOrderDTO } from '../../../application/dtos/CreateOrderDTO.js';
import type { AddItemToOrderDTO } from '../../../application/dtos/AddItemToOrderDTO.js';

/**
 * Controlador de órdenes para Fastify
 * Expone endpoints HTTP para crear órdenes y agregar items
 */
export class OrderController {
  constructor(
    private createOrderUseCase: CreateOrderUseCase,
    private addItemToOrderUseCase: AddItemToOrderUseCase
  ) {}

  /**
   * POST /orders
   * Crear una nueva orden
   */
  async createOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { orderId, currency } = request.body as CreateOrderDTO;

      // Validar datos de entrada
      if (!orderId || !currency) {
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

        reply.code(statusCode).send({
          error: errorType,
          message: error.message,
        });
        return;
      }

      reply.code(201).send({
        success: true,
        data: result.value,
      });
    } catch (error) {
      this.handleUnexpectedError(error, reply);
    }
  }

  /**
   * POST /orders/:orderId/items
   * Agregar un item a una orden existente
   */
  async addItemToOrder(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const { orderId } = request.params as { orderId: string };
      const { sku, quantity } = request.body as Omit<AddItemToOrderDTO, 'orderId'>;

      // Validar datos de entrada
      if (!orderId || !sku || quantity === undefined) {
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

        reply.code(statusCode).send({
          error: errorType,
          message: error.message,
        });
        return;
      }

      reply.code(200).send({
        success: true,
        message: 'Item agregado a la orden',
      });
    } catch (error) {
      this.handleUnexpectedError(error, reply);
    }
  }

  /**
   * Registrar las rutas en la instancia de Fastify
   */
  static registerRoutes(
    fastify: FastifyInstance,
    createOrderUseCase: CreateOrderUseCase,
    addItemToOrderUseCase: AddItemToOrderUseCase
  ): void {
    const controller = new OrderController(createOrderUseCase, addItemToOrderUseCase);

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
  private handleUnexpectedError(error: unknown, reply: FastifyReply): void {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('Error inesperado:', error);
    reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message,
    });
  }
}
