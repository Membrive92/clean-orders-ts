# Application Layer - Clean Architecture

## 📋 Overview

The application layer orchestrates the domain with infrastructure. It is responsible for:

1. Validating user inputs
2. Coordinating domain operations
3. Persisting data and publishing events
4. Mapping errors to discriminated types
5. Keeping business logic pure (in the domain)

## 🚨 Errors - Discriminated Unions

### Structure

```typescript
type AppErrorType = ValidationError | NotFoundError | ConflictError | InfraError;

// Use case errors mapped to discriminated types:
type UseCaseError = 
  | { type: 'VALIDATION_ERROR'; message: string }
  | { type: 'NOT_FOUND_ERROR'; message: string }
  | { type: 'CONFLICT_ERROR'; message: string }
  | { type: 'INFRA_ERROR'; message: string }
```

### Error Types

| Error | Cause | Example |
|-------|-------|---------|
| `ValidationError` | Invalid input | Empty SKU, unknown currency |
| `NotFoundError` | Resource doesn't exist | Order not found |
| `ConflictError` | Business rule violated | Duplicate order, cannot add items |
| `InfraError` | I/O failure | DB error, API error |

### Usage

```typescript
// In use case
if (!dto.orderId) {
  const error = new ValidationError('orderId required');
  return fail({ type: 'VALIDATION_ERROR', message: error.message });
}

// In handler
const result = await useCase.execute(dto);
if (!result.success) {
  switch (result.error.type) {
    case 'VALIDATION_ERROR':
      return res.status(400).json({ error: result.error.message });
    case 'NOT_FOUND_ERROR':
      return res.status(404).json({ error: result.error.message });
    case 'CONFLICT_ERROR':
      return res.status(409).json({ error: result.error.message });
    case 'INFRA_ERROR':
      return res.status(500).json({ error: result.error.message });
  }
}
```

## 🔌 Ports (Interfaces)

### OrderRepository

```typescript
interface OrderRepository {
  save(order: Order): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<Order | null, string>>;
  update(order: Order): Promise<Result<void, string>>;
  findAll(limit?, offset?): Promise<Result<Order[], string>>;
}
```

**Responsibility:** Order persistence (DB agnostic)

**Possible implementations:**
- InMemoryRepository (testing)
- PostgresRepository (BD relacional)
- MongoRepository (documento)
- DynamoDBRepository (NoSQL)

### PricingService

```typescript
interface PricingService {
  getPriceForSku(sku: string, currency: string): Promise<Result<number, string>>;
  skuExists(sku: string): Promise<Result<boolean, string>>;
  getProductDetails(sku: string): Promise<Result<{...}, string>>;
}
```

**Responsibility:** Get product prices

**Possible implementations:**
- HttpPricingService (external API)
- DatabasePricingService (local DB)
- CachedPricingService (with cache)

### EventBus

```typescript
interface EventBus {
  publish(events: DomainEvent[]): Promise<Result<void, string>>;
  publishSingle(event: DomainEvent): Promise<Result<void, string>>;
  subscribe(eventType: string, handler): void;
  unsubscribe(eventType: string, handler): void;
}
```

**Responsibility:** Publish and subscribe to domain events

**Possible implementations:**
- InMemoryEventBus (testing)
- RabbitMQEventBus (message broker)
- KafkaEventBus (streaming)
- EventStoreEventBus (event sourcing)

### Clock

```typescript
interface Clock {
  now(): Date;
  timestamp(): number;
}
```

**Responsibility:** Get current time (abstraction for testing)

**Implementations:**
- SystemClock (system time)
- MockClock (fixed time for tests)

## 📦 DTOs (Data Transfer Objects)

### CreateOrderDTO

```typescript
interface CreateOrderDTO {
  orderId: string;
  currency: string;
}
```

**Origin:** HTTP Request, external events
**Destination:** CreateOrderUseCase

### AddItemToOrderDTO

```typescript
interface AddItemToOrderDTO {
  orderId: string;
  sku: string;
  quantity: number;
}
```

**Origin:** HTTP Request
**Destination:** AddItemToOrderUseCase

## 🎯 Use Cases

### CreateOrderUseCase

**Responsibilities:**
1. ✅ Validate DTO (orderId, currency)
2. ✅ Create Currency Value Object
3. ✅ Verify order doesn't exist (query repository)
4. ✅ Create Order in domain
5. ✅ Persist order (repository.save)
6. ✅ Publish events (eventBus.publish)
7. ✅ Clear events

**Possible errors:**
- `VALIDATION_ERROR`: Invalid DTO or Value Object
- `CONFLICT_ERROR`: Duplicate order
- `INFRA_ERROR`: DB or event bus error

**Signature:**
```typescript
execute(dto: CreateOrderDTO): Promise<Result<{ orderId: string }, CreateOrderError>>
```

### AddItemToOrderUseCase

**Responsibilities:**
1. ✅ Validate DTO (orderId, sku, quantity)
2. ✅ Get order (repository.findById)
3. ✅ Create SKU Value Object
4. ✅ Create Quantity Value Object
5. ✅ Get price (pricingService.getPriceForSku)
6. ✅ Create Money Value Object
7. ✅ Add item to domain (order.addItem)
8. ✅ Persist order (repository.update)
9. ✅ Publish events (eventBus.publish)
10. ✅ Clear events

**Possible errors:**
- `VALIDATION_ERROR`: Invalid DTO, SKU, Quantity or Money
- `NOT_FOUND_ERROR`: Order not found
- `CONFLICT_ERROR`: Cannot add items (incorrect state, duplicate SKU)
- `INFRA_ERROR`: DB, pricing service, or event bus error

**Signature:**
```typescript
execute(dto: AddItemToOrderDTO): Promise<Result<void, AddItemToOrderError>>
```

## 🔄 Complete Flow - CreateOrder

```
HTTP Request (POST /orders)
    ↓
Controller extracts DTO
    ↓
CreateOrderUseCase.execute(dto)
    ├─ Validate inputs
    ├─ Create Currency VO
    ├─ Verify doesn't exist (OrderRepository.findById)
    ├─ Create Order aggregate (domain)
    ├─ Persist (OrderRepository.save)
    ├─ Publish events (EventBus.publish)
    └─ Return Result<{ orderId }, Error>
    ↓
Controller maps error or returns response
    ↓
HTTP Response (201 Created / 400 Bad Request / 409 Conflict / 500 Error)
```

## 🔄 Complete Flow - AddItemToOrder

```
HTTP Request (POST /orders/{id}/items)
    ↓
Controller extracts DTO
    ↓
AddItemToOrderUseCase.execute(dto)
    ├─ Validate inputs
    ├─ Get Order (OrderRepository.findById)
    ├─ Create SKU VO
    ├─ Create Quantity VO
    ├─ Get price (PricingService.getPriceForSku)
    ├─ Create Money VO
    ├─ Add item (Order.addItem - with domain validations)
    ├─ Persist (OrderRepository.update)
    ├─ Publish events (EventBus.publish)
    └─ Return Result<void, Error>
    ↓
Controller maps error or returns response
    ↓
HTTP Response (204 No Content / 400 Bad Request / 404 Not Found / 409 Conflict / 500 Error)
```

## ✅ Advantages of this structure

1. **Separation of concerns:** Domain ↔ Application ↔ Infrastructure
2. **Explicit errors:** Discriminated types allow handling each case
3. **Testable:** Ports are interfaces, easy to mock
4. **Technology agnostic:** No framework dependencies in domain/application
5. **Reusable:** Use cases can be used from HTTP, CLI, events, etc.
6. **Composable:** Result type allows chaining operations

## 🎬 Implementation Status

1. ✅ **Infrastructure Layer:** Repositories, services, event bus implemented
2. ✅ **HTTP Adapters:** Controllers using the use cases
3. ✅ **Tests:** Complete suite for use cases with mocks (58 tests)
4. ✅ **Composition Root:** Dependency injection and wiring
5. ✅ **Acceptance Tests:** End-to-end scenarios with in-memory adapters
