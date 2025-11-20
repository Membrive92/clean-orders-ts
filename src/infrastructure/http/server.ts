import Fastify from 'fastify';
import type { Dependencies } from '../../composition/container.js';
import { OrderController } from './controllers/OrderController.js';
import { PinoLogger } from '../loggin/PinoLogger.js';

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
    // Prevent server from crashing on unhandled errors
    disableRequestLogging: false,
  });

  // Global error handler
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error, 'Request error');
    
    // Send appropriate error response
    const statusCode = error.statusCode || 500;
    reply.code(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      statusCode,
    });
  });

  // Crear logger para los controladores
  const logger = new PinoLogger({ name: 'order-controller' });

  // Registrar rutas del controlador con las dependencias inyectadas
  OrderController.registerRoutes(
    fastify,
    dependencies.createOrderUseCase,
    dependencies.addItemToOrderUseCase,
    logger
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
