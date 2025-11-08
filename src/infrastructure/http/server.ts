import Fastify from 'fastify';
import { InMemoryOrderRepository } from '../persistence/in-memory/InMemoryOrderRepository.js';
import { StaticPricingService } from './StaticPricingService.js';
import { InMemoryEventBus } from '../messaging/InMemoryEventBus.js';
import { CreateOrderUseCase } from '../../application/use-cases/CreateOrderUseCase.js';
import { AddItemToOrderUseCase } from '../../application/use-cases/AddItemToOrderUseCase.js';
import { OrderController } from './controllers/OrderController.js';

/**
 * Factory para crear y configurar el servidor Fastify
 * Inicializa todas las dependencias necesarias
 */
export class FastifyServerFactory {
  static async create() {
    // Crear instancia de Fastify
    const fastify = Fastify({
      logger: true,
    });

    // Inicializar dependencias (infraestructura)
    const orderRepository = new InMemoryOrderRepository();
    const pricingService = new StaticPricingService();
    const eventBus = new InMemoryEventBus();

    // Crear use cases con las dependencias
    const createOrderUseCase = new CreateOrderUseCase(
      orderRepository,
      eventBus
    );

    const addItemToOrderUseCase = new AddItemToOrderUseCase(
      orderRepository,
      pricingService,
      eventBus
    );

    // Registrar rutas del controlador
    OrderController.registerRoutes(
      fastify,
      createOrderUseCase,
      addItemToOrderUseCase
    );

    // Health check endpoint
    fastify.get('/health', async (_request, reply) => {
      reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    });

    return fastify;
  }

  /**
   * Iniciar el servidor
   */
  static async start() {
    const fastify = await this.create();
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    try {
      await fastify.listen({ port, host });
      console.log(`✓ Servidor ejecutándose en http://${host}:${port}`);
      return fastify;
    } catch (error) {
      fastify.log.error(error);
      process.exit(1);
    }
  }
}

// Iniciar servidor si se ejecuta directamente
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  FastifyServerFactory.start();
}
