# Infrastructure Layer - Clean Architecture

## 📋 Overview

The infrastructure layer provides concrete implementations of the ports defined in the application layer. It handles all external concerns like databases, HTTP clients, messaging systems, and third-party integrations while remaining independent of business logic.

## 🔌 Port Implementations

### 📊 Persistence Layer

#### **InMemoryOrderRepository**
```typescript
// src/infrastructure/persistence/in-memory/InMemoryOrderRepository.ts
export class InMemoryOrderRepository implements OrderRepository
```

**Purpose:** In-memory implementation for testing and development
**Features:**
- Thread-safe Map-based storage
- Automatic ID validation
- Result pattern for error handling
- Testing utilities (clear, count methods)

**Use cases:**
- ✅ Unit testing
- ✅ Integration testing
- ✅ Local development
- ✅ Acceptance testing

#### **PostgreSQLOrderRepository** (Future)
```typescript
export class PostgreSQLOrderRepository implements OrderRepository
```

**Features:**
- Connection pooling
- Transaction support
- Optimistic locking
- Migration support

### 🏷️ Pricing Service

#### **StaticPricingService**
```typescript
// src/infrastructure/http/StaticPricingService.ts
export class StaticPricingService implements PricingService
```

**Purpose:** Static price catalog for testing and demos
**Features:**
- Predefined product catalog (25+ products)
- Multi-currency support (USD, EUR, MXN, ARS)
- Runtime price updates (for testing)
- Product existence validation

**Catalog includes:**
- Electronics (laptops, phones, headphones)
- Clothing (shirts, jeans, shoes)
- Home & Garden (furniture, appliances)
- Books and more

#### **HttpPricingService** (Future)
```typescript
export class HttpPricingService implements PricingService
```

**Features:**
- External API integration
- Response caching
- Retry logic
- Circuit breaker pattern

### 📨 Event Bus

#### **InMemoryEventBus**
```typescript
// src/infrastructure/messaging/InMemoryEventBus.ts
export class InMemoryEventBus implements EventBus
```

**Purpose:** In-memory event handling for testing
**Features:**
- Event storage and retrieval
- Subscription management
- Event filtering by type
- Testing utilities (getEvents, clear, count)

**Testing capabilities:**
```typescript
// Verify events were published
const events = eventBus.getEvents();
expect(events).toHaveLength(2);

// Filter by event type
const orderCreatedEvents = eventBus.getEventsByType('OrderCreated');
expect(orderCreatedEvents).toHaveLength(1);
```

#### **NoopEventBus**
```typescript
// src/infrastructure/messaging/NoopEventBus.ts
export class NoopEventBus implements EventBus
```

**Purpose:** No-operation implementation (discards all events)
**Use cases:**
- Performance testing
- Scenarios where events aren't needed
- Simplified testing

#### **RabbitMQEventBus** (Future)
```typescript
export class RabbitMQEventBus implements EventBus
```

**Features:**
- Message broker integration
- Durable queues
- Dead letter queues
- Retry mechanisms

### ⏰ Clock Adapters

#### **SystemClock**
```typescript
// src/infrastructure/adapters/SystemClock.ts
export class SystemClock implements Clock
```

**Purpose:** Production time source
**Features:**
- System time integration
- Timezone handling
- Millisecond precision

#### **MockClock**
```typescript
// src/infrastructure/adapters/MockClock.ts
export class MockClock implements Clock
```

**Purpose:** Deterministic time for testing
**Features:**
- Fixed time setting
- Time advancement simulation
- Deterministic testing

**Usage:**
```typescript
const clock = new MockClock(new Date('2024-01-01T12:00:00Z'));
clock.advance(1000 * 60 * 60); // Advance 1 hour
expect(clock.now()).toEqual(new Date('2024-01-01T13:00:00Z'));
```

## 🌐 HTTP Layer

### **OrderController**
```typescript
// src/infrastructure/http/controllers/OrderController.ts
export class OrderController
```

**Endpoints:**
- `POST /orders` - Create new order
- `POST /orders/:id/items` - Add item to order
- `GET /health` - Health check

**Features:**
- Request validation
- Error mapping (domain → HTTP status codes)
- JSON serialization
- Fastify integration

**Error mapping:**
```typescript
ValidationError → 400 Bad Request
NotFoundError → 404 Not Found
ConflictError → 409 Conflict
InfraError → 500 Internal Server Error
```

### **Server Configuration**
```typescript
// src/infrastructure/http/server.ts
export async function buildServer(dependencies: Dependencies)
```

**Features:**
- Dependency injection
- Route registration
- Error handling middleware
- Health check endpoint
- Logging configuration

## 🏗️ Composition Root

### **Dependency Container**
```typescript
// src/composition/container.ts
export function buildContainer(): Dependencies
```

**Responsibilities:**
- Wire all dependencies
- Configure adapters
- Provide dependency graph
- Enable testing with different implementations

**Dependency graph:**
```
Dependencies
├── OrderRepository (InMemoryOrderRepository)
├── PricingService (StaticPricingService)
├── EventBus (InMemoryEventBus)
├── Clock (SystemClock)
├── CreateOrderUseCase
└── AddItemToOrderUseCase
```

### **Application Entry Point**
```typescript
// src/main.ts
async function main()
```

**Features:**
- Container initialization
- Server startup
- Error handling
- Graceful shutdown
- Environment configuration

## 🧪 Testing Infrastructure

### **In-Memory Adapters**
All infrastructure components provide in-memory implementations for testing:

- **InMemoryOrderRepository**: Thread-safe order storage
- **StaticPricingService**: Predictable pricing data
- **InMemoryEventBus**: Event capture and verification
- **MockClock**: Time control for deterministic tests

### **Test Utilities**
```typescript
// Testing helper methods
orderRepository.clear()           // Reset state
orderRepository.count()          // Get count
eventBus.getEvents()            // Get all events
eventBus.getEventsByType(type)  // Filter events
eventBus.clear()                // Reset events
clock.advance(milliseconds)     // Time travel
```

## 📊 Implementation Status

### ✅ Completed Components

| Component | Implementation | Purpose | Status |
|-----------|----------------|---------|---------|
| OrderRepository | InMemoryOrderRepository | Testing/Development | ✅ Complete |
| PricingService | StaticPricingService | Testing/Demo | ✅ Complete |
| EventBus | InMemoryEventBus | Testing | ✅ Complete |
| EventBus | NoopEventBus | Performance testing | ✅ Complete |
| Clock | SystemClock | Production | ✅ Complete |
| Clock | MockClock | Testing | ✅ Complete |
| HTTP | OrderController | REST API | ✅ Complete |
| HTTP | Server | Fastify setup | ✅ Complete |
| Composition | Container | DI wiring | ✅ Complete |
| Entry | Main | Application start | ✅ Complete |

### 🔄 Future Implementations

| Component | Implementation | Purpose | Priority |
|-----------|----------------|---------|----------|
| OrderRepository | PostgreSQLOrderRepository | Production DB | Medium |
| OrderRepository | MongoOrderRepository | Document storage | Low |
| PricingService | HttpPricingService | External API | High |
| EventBus | RabbitMQEventBus | Message broker | Medium |
| EventBus | KafkaEventBus | Event streaming | Low |

## 🏛️ Architecture Benefits

### **Dependency Inversion**
- High-level modules don't depend on low-level modules
- Both depend on abstractions (ports)
- Easy to swap implementations

### **Testability**
- All external dependencies are mockable
- In-memory implementations for fast tests
- Isolated unit testing possible

### **Technology Independence**
- Can switch databases without changing business logic
- Can replace HTTP framework without affecting use cases
- Event system is pluggable

### **Development Experience**
- Fast feedback with in-memory implementations
- No external dependencies for local development
- Comprehensive testing capabilities

## 🚀 Production Readiness

### **Current State**
- ✅ Complete in-memory implementations
- ✅ HTTP API with error handling
- ✅ Dependency injection container
- ✅ Comprehensive test coverage (58 tests)
- ✅ Clean separation of concerns

### **Production Considerations**
- Replace InMemoryOrderRepository with persistent storage
- Add HttpPricingService for real pricing data
- Implement RabbitMQEventBus for event processing
- Add monitoring and observability
- Configure proper logging
- Add authentication and authorization

The infrastructure layer successfully provides all necessary adapters while maintaining the clean architecture principles and enabling comprehensive testing without external dependencies.