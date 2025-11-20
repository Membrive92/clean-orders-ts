import Fastify from 'fastify';
import type { Dependencies } from '../../composition/container.js';
import { OrderController } from './controllers/OrderController.js';
import { PinoLogger } from '../loggin/PinoLogger.js';

/**
 * Build Fastify server with injected dependencies
 * @param dependencies - Dependency container
 * @returns Configured Fastify instance
 */
export async function buildServer(dependencies: Dependencies) {
  // Create Fastify instance with logging enabled
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

  // Create logger for controllers
  const logger = new PinoLogger({ name: 'order-controller' });

  // Register controller routes with injected dependencies
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
