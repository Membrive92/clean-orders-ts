import { DatabaseFactory } from './dist/src/infrastructure/database/DatabaseFactory.js';
import { MessagingFactory } from './dist/src/infrastructure/messaging/MessagingFactory.js';

async function testFactories() {
  console.log('🧪 Testing Factories...\n');

  try {
    // Close any existing connections first
    await DatabaseFactory.close();
    
    // Test Database Factory
    console.log('📊 Testing DatabaseFactory...');
    console.log('=' .repeat(50));

    // Test connection
    console.log('\n1️⃣  Testing connection...');
    console.log(`   Using DATABASE_URL: ${process.env.DATABASE_URL}`);
    const connected = await DatabaseFactory.testConnection();
    console.log(`   Connection: ${connected ? '✅ Success' : '❌ Failed'}`);

    if (!connected) {
      console.log('⚠️  Database not available. Skipping remaining tests.');
      return;
    }

    // Health check
    console.log('\n2️⃣  Health check...');
    const health = await DatabaseFactory.healthCheck();
    console.log(`   Healthy: ${health.healthy ? '✅' : '❌'}`);
    console.log(`   Response time: ${health.responseTime}ms`);
    if (health.error) {
      console.log(`   Error: ${health.error}`);
    }

    // Clear database
    console.log('\n3️⃣  Clearing database...');
    await DatabaseFactory.clearDatabase();

    // Seed database
    console.log('\n4️⃣  Seeding database...');
    await DatabaseFactory.seedDatabase();

    // Get statistics
    console.log('\n5️⃣  Database statistics...');
    const stats = await DatabaseFactory.getDatabaseStats();
    console.log(`   Orders: ${stats.orders}`);
    console.log(`   Order Items: ${stats.orderItems}`);
    console.log(`   Outbox Events: ${stats.outbox}`);
    console.log(`   Unpublished Events: ${stats.outboxUnpublished}`);

    // Test UnitOfWork
    console.log('\n6️⃣  Testing UnitOfWork...');
    const uow = DatabaseFactory.getUnitOfWork();
    const uowResult = await uow.run(async (repos) => {
      const order = await repos.orders.findById('order-001');
      if (!order.success || !order.value) {
        return { success: false, error: 'Order not found' };
      }
      console.log(`   ✅ Found order: ${order.value.id} (${order.value.currency.toString()})`);
      console.log(`   Items: ${order.value.getItems().length}`);
      console.log(`   Status: ${order.value.getStatus()}`);
      return { success: true, data: undefined };
    });
    console.log(`   UnitOfWork result: ${uowResult.success ? '✅' : '❌'}`);

    // Test Messaging Factory
    console.log('\n\n📨 Testing MessagingFactory...');
    console.log('='.repeat(50));

    // Messaging health check
    console.log('\n1️⃣  Messaging health check...');
    const messagingHealth = await MessagingFactory.healthCheck();
    console.log(`   Dispatcher: ${messagingHealth.dispatcher ? '✅' : '❌'}`);
    console.log(`   EventBus: ${messagingHealth.eventBus ? '✅' : '❌'}`);

    // Get dispatcher stats (before starting)
    console.log('\n2️⃣  Getting dispatcher (not started yet)...');
    const dispatcher = MessagingFactory.getDispatcher(1000, 10);
    console.log(`   ✅ Dispatcher created`);

    // Get stats
    const dispatcherStats = await MessagingFactory.getDispatcherStats();
    if (dispatcherStats) {
      console.log(`   Unpublished: ${dispatcherStats.unpublished}`);
      console.log(`   Published: ${dispatcherStats.published}`);
      console.log(`   Oldest unpublished: ${dispatcherStats.oldestUnpublished}`);
    }

    // Test in-memory event bus
    console.log('\n3️⃣  Testing InMemoryEventBus...');
    const inMemoryBus = MessagingFactory.getInMemoryEventBus();
    let eventReceived = false;
    
    inMemoryBus.subscribe('TestEvent', async (event) => {
      console.log(`   ✅ Event received: ${event.eventType}`);
      eventReceived = true;
    });

    await inMemoryBus.publishSingle({
      aggregateId: 'test-123',
      eventType: 'TestEvent',
      timestamp: new Date(),
    });

    // Wait a bit for event to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log(`   Event handled: ${eventReceived ? '✅' : '❌'}`);

    // Cleanup
    console.log('\n\n🧹 Cleaning up...');
    console.log('='.repeat(50));
    
    await MessagingFactory.close();
    console.log('✅ Messaging resources closed');
    
    await DatabaseFactory.close();
    console.log('✅ Database connections closed');

    console.log('\n✅ All tests completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testFactories();
