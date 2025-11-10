import { buildServer } from './infrastructure/http/server.js';
import { buildContainer } from './composition/container.js';

async function main() {
  try {
    // Composition Root - Dependency Injection
    const dependencies = buildContainer();
    
    // Build server with injected dependencies
    const server = await buildServer(dependencies);
    
    const host = process.env.HOST || '0.0.0.0';
    const port = parseInt(process.env.PORT || '3000', 10);
    
    await server.listen({ host, port });
    
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📋 Health check: http://${host}:${port}/health`);
    console.log(`📦 Orders API: http://${host}:${port}/orders`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

main().catch((error) => {
  console.error('💥 Unhandled error in main:', error);
  process.exit(1);
});