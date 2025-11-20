import { buildServer } from './infrastructure/http/server.js';
import { buildContainer } from './composition/container.js';
import { PinoLogger } from './infrastructure/loggin/PinoLogger.js';

const logger = new PinoLogger({ name: 'main' });
let dependencies: ReturnType<typeof buildContainer> | null = null;
let server: Awaited<ReturnType<typeof buildServer>> | null = null;

async function main() {
  try {
    // Composition Root - Dependency Injection
    logger.info('Starting application...');
    dependencies = buildContainer();
    
    // Build server with injected dependencies
    server = await buildServer(dependencies);
    
    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3000', 10);
    
    await server.listen({ host, port });
    
    logger.info('Server started successfully', {
      host,
      port,
      endpoints: {
        health: `http://${host}:${port}/health`,
        orders: `http://${host}:${port}/orders`,
      },
    });

    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📋 Health check: http://${host}:${port}/health`);
    console.log(`📦 Orders API: http://${host}:${port}/orders`);
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    await cleanup();
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * Closes all connections and resources properly
 */
async function cleanup() {
  logger.info('Starting graceful shutdown...');

  try {
    // Close HTTP server
    if (server) {
      logger.info('Closing HTTP server...');
      await server.close();
      logger.info('HTTP server closed');
    }

    // Cleanup dependencies (database connections, messaging, etc.)
    if (dependencies?.cleanup) {
      await dependencies.cleanup();
    }

    logger.info('Graceful shutdown completed');
  } catch (error) {
    logger.error('Error during cleanup', error instanceof Error ? error : new Error(String(error)));
  }
}

// Handle graceful shutdown signals
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await cleanup();
  process.exit(0);
});

// Handle uncaught errors - only for truly critical system errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception detected', error);
  
  // Only exit on critical system errors that prevent server operation
  const criticalErrors = ['EADDRINUSE', 'EACCES', 'ENOTFOUND', 'ERR_INVALID_'];
  const isCritical = criticalErrors.some(errType => error.message?.includes(errType));
  
  if (isCritical) {
    logger.error('Critical system error - shutting down');
    cleanup().then(() => process.exit(1));
  } else {
    // For non-critical errors, log and continue
    logger.warn('Non-critical error - continuing execution', { errorMessage: error.message });
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.warn('Unhandled promise rejection - logging but continuing', {
    reason: String(reason),
    promise: promise?.toString(),
  });
  // Don't exit - Fastify and other libraries handle these internally
});

main().catch((error) => {
  logger.error('Unhandled error in main', error instanceof Error ? error : new Error(String(error)));
  cleanup().then(() => process.exit(1));
});