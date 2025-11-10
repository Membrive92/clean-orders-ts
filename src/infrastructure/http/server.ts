import Fastify from 'fastify';
import type { Dependencies } from '../../composition/container.js';
import { OrderController } from './controllers/OrderController.js';

/**
 * Construye el servidor Fastify con las dependencias inyectadas
 * @param dependencies - Contenedor de dependencias
 * @returns Instancia configurada de Fastify
 */
export async function buildServer(dependencies: Dependencies) {
  // Crear instancia de Fastify con logging habilitado
  const fastify = Fastify({
    logger: {
      level: 'info',
    },
  });

  // Registrar rutas del controlador con las dependencias inyectadas
  OrderController.registerRoutes(
    fastify,
    dependencies.createOrderUseCase,
    dependencies.addItemToOrderUseCase
  );

  // Health check endpoint
  fastify.get('/health', async (_request, reply) => {
    reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'clean-orders-api',
    });
  });

  return fastify;
}
