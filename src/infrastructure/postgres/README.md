# PostgreSQL Unit of Work

Implementation of the Unit of Work pattern for PostgreSQL.

## Overview

The `PostgresUnitOfWork` manages transactional boundaries and provides transactional repositories within a single database transaction.

## Usage

### Basic Example

```typescript
import { PostgresUnitOfWork } from './infrastructure/postgres/PostgresUnitOfWork.js';
import { config } from './composition/config.js';

const unitOfWork = new PostgresUnitOfWork(config.DATABASE_URL);

// Execute work within a transaction
const result = await unitOfWork.run(async (repos) => {
  // All operations here are within the same transaction
  
  // Create an order
  const order = Order.create('order-123', currency);
  order.addItem(sku, quantity, price);
  
  // Save using the transactional repository
  await repos.orders.save(order);
  
  // Find and update
  const foundOrder = await repos.orders.findById('order-123');
  if (!foundOrder.success || !foundOrder.value) {
    return fail('Order not found');
  }
  
  foundOrder.value.confirm();
  await repos.orders.update(foundOrder.value);
  
  // If we return success, transaction commits
  return ok('Order processed successfully');
});

// If result.success is false, transaction was rolled back
if (!result.success) {
  console.error('Transaction failed:', result.error);
}
```

### Multiple Operations in Single Transaction

```typescript
await unitOfWork.run(async (repos) => {
  // Create multiple orders
  const order1 = Order.create('order-1', usd);
  const order2 = Order.create('order-2', usd);
  
  // All saves happen in the same transaction
  await repos.orders.save(order1);
  await repos.orders.save(order2);
  
  // If any operation fails, ALL changes are rolled back
  return ok(undefined);
});
```

### Handling Failures

```typescript
const result = await unitOfWork.run(async (repos) => {
  const order = Order.create('order-456', eur);
  await repos.orders.save(order);
  
  // Business logic failure - transaction will rollback
  if (someConditionFails) {
    return fail('Business rule violated');
  }
  
  return ok(undefined);
});

// Transaction was rolled back, order was not saved
console.log(result.success); // false
console.log(result.error); // "Business rule violated"
```

## How It Works

1. **Begin Transaction**: When `run()` is called, it acquires a client from the pool and executes `BEGIN`
2. **Provide Repositories**: Creates transactional repositories using the same client
3. **Execute Work**: Your callback function receives these repositories
4. **Commit or Rollback**:
   - If work returns `ok()`: Transaction commits
   - If work returns `fail()`: Transaction rolls back
   - If work throws exception: Transaction rolls back

## Benefits

### Transaction Safety
All operations within `run()` are atomic - they either all succeed or all fail.

### Automatic Cleanup
The client is always released back to the pool, even if errors occur.

### Type Safety
Fully typed with TypeScript - repositories and return values are type-checked.

### Result Pattern
Uses `Result<T, E>` for explicit error handling without exceptions.

## Connection Pool Configuration

The pool is configured with:
- **max**: 20 connections
- **idleTimeoutMillis**: 30 seconds
- **connectionTimeoutMillis**: 2 seconds

## Methods

### `run<T>(work: (repos: Repositories) => Promise<Result<T, string>>): Promise<Result<T, string>>`

Execute work within a transaction.

**Parameters:**
- `work`: Async function that receives repositories and returns a Result

**Returns:**
- `Result<T, string>`: Success with return value or failure with error message

### `close(): Promise<void>`

Close the connection pool. Call when shutting down the application.

### `healthCheck(): Promise<Result<void, string>>`

Test database connection.

## Available Repositories

Within the `run()` callback, you have access to:

- `repos.orders`: OrderRepository with all CRUD operations

## Example: Use Case Integration

```typescript
class AddItemToOrderUseCase {
  constructor(private unitOfWork: UnitOfWork) {}
  
  async execute(orderId: string, sku: string, quantity: number, price: number): Promise<Result<void, string>> {
    return this.unitOfWork.run(async (repos) => {
      // Find order
      const orderResult = await repos.orders.findById(orderId);
      if (!orderResult.success) return fail(orderResult.error);
      if (!orderResult.value) return fail('Order not found');
      
      const order = orderResult.value;
      
      // Business logic
      const skuVO = SKU.create(sku);
      const qtyVO = Quantity.create(quantity);
      const priceVO = Money.create(price, order.currency);
      
      if (!skuVO.success || !qtyVO.success || !priceVO.success) {
        return fail('Invalid parameters');
      }
      
      const addResult = order.addItem(skuVO.value, qtyVO.value, priceVO.value);
      if (!addResult.success) return fail(addResult.error);
      
      // Save changes
      const updateResult = await repos.orders.update(order);
      if (!updateResult.success) return fail(updateResult.error);
      
      return ok(undefined);
    });
  }
}
```

## Testing

Integration tests verify:
- ✅ Transaction commits on success
- ✅ Transaction rolls back on business logic failure
- ✅ Transaction rolls back on exceptions
- ✅ Multiple operations in single transaction
- ✅ Transaction isolation
- ✅ All repository methods work within transaction

Tests automatically skip when `USE_INMEMORY=true`.
