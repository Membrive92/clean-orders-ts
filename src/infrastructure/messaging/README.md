# Transactional Outbox Pattern

Implementation of the Transactional Outbox Pattern for reliable event publishing.

## Overview

The Outbox Pattern ensures that domain events are reliably published even if the message broker is temporarily unavailable. Events are persisted to the database in the same transaction as the aggregate, then asynchronously published by a separate worker process.

## Components

### OutboxEventBus

Implements the `EventBus` interface and persists events to the `outbox` table.

```typescript
import { OutboxEventBus } from './infrastructure/messaging/OutboxEventBus.js';

const eventBus = new OutboxEventBus(config.DATABASE_URL);

// Publish events (within a transaction)
await eventBus.publish(order.getDomainEvents());
```

### OutboxDispatcher

Background worker that polls the outbox table and publishes pending events.

```typescript
import { OutboxDispatcher } from './infrastructure/messaging/OutboxDispatcher.js';

const dispatcher = new OutboxDispatcher(
  config.DATABASE_URL,
  5000,  // Poll interval: 5 seconds
  100    // Batch size: 100 events per batch
);

await dispatcher.start();
```

## How It Works

### 1. Event Persistence (OutboxEventBus)

When domain events are published:

```typescript
// In your use case or repository
const order = Order.create('order-123', currency);
order.addItem(sku, quantity, price);

await repository.save(order);

// Events are persisted to outbox table
await eventBus.publish(order.getDomainEvents());
```

The events are stored with:
- `aggregate_id`: ID of the aggregate that generated the event
- `aggregate_type`: Type of aggregate (e.g., "Order")
- `event_type`: Type of event (e.g., "OrderCreated")
- `event_data`: Full event as JSON
- `created_at`: When the event was created
- `published_at`: NULL when pending, timestamp when published

### 2. Event Publishing (OutboxDispatcher)

The dispatcher runs continuously:

```
┌─────────────────────────────────────┐
│ Poll for Unpublished Events         │
│                                     │
│ SELECT * FROM outbox               │
│ WHERE published_at IS NULL         │
│ ORDER BY created_at ASC            │
│ LIMIT 100                          │
│ FOR UPDATE SKIP LOCKED             │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Publish to Message Broker           │
│ (RabbitMQ, Kafka, etc.)            │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ Mark as Published                   │
│                                     │
│ UPDATE outbox                      │
│ SET published_at = NOW()           │
│ WHERE id = $1                      │
└─────────────────────────────────────┘
```

### 3. Concurrency Safety

**FOR UPDATE SKIP LOCKED** ensures multiple dispatcher instances can run concurrently without processing the same events:

```sql
SELECT * FROM outbox
WHERE published_at IS NULL
ORDER BY created_at ASC
LIMIT 100
FOR UPDATE SKIP LOCKED  -- Key to concurrent safety
```

- Locks the selected rows for the current transaction
- **SKIP LOCKED** makes other workers skip locked rows
- Each worker processes different events
- Enables horizontal scaling

## Database Schema

```sql
CREATE TABLE outbox (
    id SERIAL PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE NULL
);

-- Critical index for finding unpublished events
CREATE INDEX idx_outbox_unpublished 
    ON outbox(created_at ASC) 
    WHERE published_at IS NULL;
```

## Usage Examples

### Basic Usage

```typescript
// In your application startup
import { OutboxEventBus, OutboxDispatcher } from './infrastructure/messaging';

const eventBus = new OutboxEventBus(config.DATABASE_URL);
const dispatcher = new OutboxDispatcher(config.DATABASE_URL);

// Start the dispatcher
await dispatcher.start();

// Use eventBus in your repositories/use cases
await eventBus.publish(events);
```

### With Unit of Work

```typescript
const result = await unitOfWork.run(async (repos) => {
  const order = await repos.orders.findById(orderId);
  
  // Modify aggregate
  order.addItem(sku, quantity, price);
  
  // Save aggregate and events in same transaction
  await repos.orders.update(order);
  await eventBus.publish(order.getDomainEvents());
  
  return ok(undefined);
});
```

### Running the Dispatcher

```bash
# As a separate process
npm run worker:outbox

# Or in production with PM2
pm2 start npm --name "outbox-worker" -- run worker:outbox
```

### Multiple Workers (Horizontal Scaling)

```bash
# Start multiple instances for higher throughput
npm run worker:outbox &  # Worker 1
npm run worker:outbox &  # Worker 2
npm run worker:outbox &  # Worker 3

# Each worker safely processes different events
# No duplicate processing thanks to FOR UPDATE SKIP LOCKED
```

## Configuration

### OutboxDispatcher Parameters

```typescript
new OutboxDispatcher(
  connectionString: string,  // PostgreSQL connection string
  pollIntervalMs: number,    // How often to poll (default: 5000ms)
  batchSize: number         // Max events per batch (default: 100)
)
```

**Tuning Guidelines:**
- **pollIntervalMs**: Lower = more responsive, higher = less DB load
- **batchSize**: Higher = more throughput, but longer transaction times

## Monitoring

### Get Statistics

```typescript
const stats = await dispatcher.getStats();

console.log({
  unpublished: stats.unpublished,       // Events waiting to be published
  published: stats.published,           // Total published events
  oldestUnpublished: stats.oldestUnpublished  // Age of oldest pending event
});
```

### Health Check

```typescript
const isHealthy = await dispatcher.healthCheck();
if (!isHealthy) {
  console.error('Dispatcher cannot connect to database');
}
```

### Logging

The dispatcher uses Pino for structured logging:

```typescript
// Logs include:
// - Events processed per batch
// - Individual event publishing
// - Errors during processing
// - Poll statistics
```

## Error Handling

### Retry Strategy

If an event fails to publish:
1. The event is **NOT** marked as published
2. It will be retried on the next poll
3. Events remain in order (FIFO)
4. Failed events don't block subsequent events

### Dead Letter Queue (Future Enhancement)

For events that fail repeatedly:

```sql
-- Add retry count
ALTER TABLE outbox ADD COLUMN retry_count INT DEFAULT 0;
ALTER TABLE outbox ADD COLUMN last_error TEXT;

-- Move to DLQ after N retries
CREATE TABLE outbox_dlq AS TABLE outbox;
```

## Best Practices

### 1. Publish Within Transaction

Always publish events within the same transaction as the aggregate save:

```typescript
await unitOfWork.run(async (repos) => {
  await repos.orders.save(order);
  await eventBus.publish(order.getDomainEvents());
  return ok(undefined);
});
```

### 2. Clear Events After Publishing

```typescript
order.clearDomainEvents();  // Prevent double-publishing
```

### 3. Monitor Lag

Set up alerts if `oldestUnpublished` exceeds a threshold:

```typescript
const stats = await dispatcher.getStats();
const lagMs = Date.now() - stats.oldestUnpublished.getTime();

if (lagMs > 60000) {  // 1 minute lag
  alert('Outbox processing is lagging!');
}
```

### 4. Archive Old Events

Periodically archive published events:

```sql
-- Move old published events to archive
INSERT INTO outbox_archive
SELECT * FROM outbox
WHERE published_at < NOW() - INTERVAL '30 days';

DELETE FROM outbox
WHERE published_at < NOW() - INTERVAL '30 days';
```

## Testing

### Integration Tests

```typescript
describe('Outbox Pattern', () => {
  it('should persist and publish events', async () => {
    // Persist event
    await eventBus.publishSingle(event);
    
    // Verify in outbox
    const unpublished = await getUnpublishedCount();
    expect(unpublished).toBe(1);
    
    // Run dispatcher
    await dispatcher.poll();
    
    // Verify published
    const stillUnpublished = await getUnpublishedCount();
    expect(stillUnpublished).toBe(0);
  });
});
```

Run with:
```bash
npm run test:integration
```

## Production Deployment

### Docker Compose

```yaml
services:
  app:
    build: .
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/orders
    depends_on:
      - db
  
  outbox-worker:
    build: .
    command: npm run worker:outbox
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/orders
    depends_on:
      - db
    deploy:
      replicas: 3  # Multiple workers for throughput
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: outbox-dispatcher
spec:
  replicas: 3
  selector:
    matchLabels:
      app: outbox-dispatcher
  template:
    spec:
      containers:
      - name: dispatcher
        image: orders-app:latest
        command: ["npm", "run", "worker:outbox"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
```

## Advantages

✅ **Guaranteed Delivery**: Events are never lost  
✅ **Transactional Consistency**: Events and aggregates saved atomically  
✅ **Decoupled**: Message broker failures don't affect domain logic  
✅ **Scalable**: Multiple workers can process concurrently  
✅ **Ordered**: Events processed in FIFO order  
✅ **Resilient**: Automatic retry on failures  

## Trade-offs

⚠️ **Eventual Consistency**: Events published after commit (ms to seconds)  
⚠️ **Database Load**: Additional writes to outbox table  
⚠️ **Storage**: Old events need archiving  
⚠️ **Complexity**: Requires separate worker process  

## Further Reading

- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [FOR UPDATE SKIP LOCKED](https://www.2ndquadrant.com/en/blog/what-is-select-skip-locked-for-in-postgresql-9-5/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
