# Clean Architecture - Order Microservice

## Table of Contents

1. [Overview](#overview)
2. [Clean Architecture Principles](#clean-architecture-principles)
3. [Architecture Layers](#architecture-layers)
4. [Directory Structure](#directory-structure)
5. [Dependency Flow](#dependency-flow)
6. [Design Patterns](#design-patterns)
7. [How to Test the Application](#how-to-test-the-application)
8. [Example Flows](#example-flows)

## Overview

This project implements a **Clean Architecture** pattern for an order management system. The architecture ensures:

- ✅ **Independence from frameworks** - Business logic doesn't depend on Fastify, PostgreSQL, or Pino
- ✅ **Testability** - Each layer can be tested independently
- ✅ **Independence from UI** - Business logic works with any delivery mechanism
- ✅ **Independence from Database** - Can switch between PostgreSQL and in-memory without changing business logic
- ✅ **Independence from external services** - Pricing service is abstracted behind ports

## Clean Architecture Principles

### The Dependency Rule

> **Source code dependencies must point only inward, toward higher-level policies.**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │                                           │ │
│  │  ┌─────────────────────────────────────┐ │ │
│  │  │                                     │ │ │
│  │  │  ┌───────────────────────────────┐ │ │ │
│  │  │  │                               │ │ │ │
│  │  │  │      Domain (Entities)        │ │ │ │
│  │  │  │   - Order                     │ │ │ │
│  │  │  │   - Value Objects             │ │ │ │
│  │  │  │   - Domain Events             │ │ │ │
│  │  │  │                               │ │ │ │
│  │  │  └───────────────────────────────┘ │ │ │
│  │  │                                     │ │ │
│  │  │      Application (Use Cases)        │ │ │
│  │  │   - CreateOrderUseCase            │ │ │
│  │  │   - AddItemToOrderUseCase         │ │ │
│  │  │   - Ports (Interfaces)            │ │ │
│  │  │                                     │ │ │
│  │  └─────────────────────────────────────┘ │ │
│  │                                           │ │
│  │         Infrastructure                    │ │
│  │   - PostgreSQL Repository                │ │
│  │   - In-Memory Repository                 │ │
│  │   - Outbox Pattern                       │ │
│  │   - Pino Logger                          │ │
│  │                                           │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│              HTTP (Delivery)                    │
│   - Fastify Server                             │
│   - Controllers                                │
│   - Routes                                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key Concepts

1. **Entities (Domain)** - Enterprise business rules
2. **Use Cases (Application)** - Application business rules
3. **Interface Adapters (Infrastructure)** - Convert data between use cases and external services
4. **Frameworks & Drivers (HTTP)** - External tools and delivery mechanisms

## Architecture Layers

### 1. Domain Layer (Core)

**Location:** `src/domain/`

The innermost layer containing enterprise business rules. **Has zero dependencies** on other layers.

#### Responsibilities:
- Define business entities and their behavior
- Enforce business rules and invariants
- Emit domain events
- Value objects for type safety

#### Components:

```
src/domain/
├── entities/
│   └── Order.ts              # Aggregate root: Order entity with business logic
│
├── value-objects/
│   ├── Currency.ts           # Valid currencies: USD, EUR, MXN, ARS
│   ├── Money.ts              # Money = amount + currency (prevents mixing currencies)
│   ├── OrderStatus.ts        # Order lifecycle: DRAFT → CONFIRMED → FINALIZED
│   ├── Quantity.ts           # Valid quantity: 1-10000
│   └── SKU.ts                # Product identifier (non-empty string)
│
├── events/
│   ├── DomainEvent.ts        # Base interface for all domain events
│   ├── OrderCreated.ts       # Event: New order created
│   ├── ItemAddedToOrder.ts   # Event: Item added to order
│   └── OrderConfirmed.ts     # Event: Order confirmed
│
└── errors/
    ├── InvalidCurrencyError.ts
    ├── InvalidQuantityError.ts
    ├── InvalidSKUError.ts
    └── OrderError.ts
```

#### Example Entity:

```typescript
// Domain entity with business logic
export class Order {
  private constructor(
    public readonly id: string,
    public readonly currency: Currency,
    private _status: OrderStatus,
    private _items: OrderItem[],
    private _events: DomainEvent[]
  ) {}

  // Business rule: Can only add items in DRAFT status
  addItem(sku: SKU, quantity: Quantity, unitPrice: Money): void {
    if (!this.currency.equals(unitPrice.currency)) {
      throw new OrderError('Currency mismatch');
    }
    
    // Business logic here...
    this._events.push(new ItemAddedToOrder(this.id, sku.value, quantity.value));
  }
}
```

### 2. Application Layer (Use Cases)

**Location:** `src/application/`

Contains application-specific business rules and orchestrates the flow of data between domain and infrastructure.

#### Responsibilities:
- Implement use cases (user stories)
- Orchestrate domain entities
- Define ports (interfaces) for external dependencies
- Transform DTOs to/from domain entities

#### Components:

```
src/application/
├── use-cases/
│   ├── CreateOrderUseCase.ts      # Use case: Create a new order
│   │   1. Validate input DTO
│   │   2. Create domain entity
│   │   3. Persist via repository
│   │   4. Publish domain events
│   │
│   └── AddItemToOrderUseCase.ts   # Use case: Add item to existing order
│       1. Validate input DTO
│       2. Load order from repository
│       3. Get price from pricing service
│       4. Add item to order (domain logic)
│       5. Persist changes
│       6. Publish events
│
├── ports/
│   ├── OrderRepository.ts         # Port: Order persistence abstraction
│   ├── PricingService.ts          # Port: Product pricing abstraction
│   ├── EventBus.ts                # Port: Event publishing abstraction
│   ├── Clock.ts                   # Port: Time abstraction (testability)
│   └── UnitOfWork.ts              # Port: Transaction management
│
├── dtos/
│   ├── CreateOrderDTO.ts          # Input: { orderId?, currency }
│   └── AddItemToOrderDTO.ts       # Input: { orderId, sku, quantity }
│
└── errors/
    ├── ValidationError.ts         # Invalid input
    ├── NotFoundError.ts           # Entity not found
    ├── ConflictError.ts           # Business rule violation
    └── InfraError.ts              # Infrastructure failure
```

#### Port Example:

```typescript
// Application defines what it needs, not how it's implemented
export interface OrderRepository {
  save(order: Order): Promise<Result<void, string>>;
  findById(orderId: string): Promise<Result<Order | null, string>>;
  findAll(): Promise<Result<Order[], string>>;
}
```

### 3. Infrastructure Layer (Adapters)

**Location:** `src/infrastructure/`

Implements the ports defined in the application layer. Provides concrete implementations for external services.

#### Responsibilities:
- Implement repository adapters
- Implement external service adapters
- Database access
- Event bus implementation
- Logging implementation

#### Components:

```
src/infrastructure/
├── database/
│   ├── DatabaseFactory.ts               # Singleton: PostgreSQL connection pool manager
│   │   - getPool()                      # Get shared connection pool
│   │   - createOrderRepository()        # Factory for repository
│   │   - runMigrations()                # Execute SQL migrations
│   │   - seedDatabase()                 # Insert test data
│   │   - close()                        # Cleanup connections
│   │
│   ├── PostgresOrderRepository.ts       # Adapter: OrderRepository → PostgreSQL
│   │   - save()                         # INSERT/UPDATE orders
│   │   - findById()                     # SELECT by ID
│   │   - findAll()                      # SELECT with pagination
│   │
│   └── PostgresUnitOfWork.ts            # Adapter: Transaction management
│       - execute()                      # BEGIN → work → COMMIT/ROLLBACK
│
├── persistence/
│   └── in-memory/
│       └── InMemoryOrderRepository.ts   # Adapter: OrderRepository → Map<string, Order>
│           - Fast for testing
│           - No database required
│
├── messaging/
│   ├── InMemoryEventBus.ts              # Adapter: EventBus → in-memory pub/sub
│   ├── OutboxRepository.ts              # Transactional outbox implementation
│   ├── OutboxDispatcher.ts              # Worker: Polls and publishes events
│   ├── MessagingFactory.ts              # Factory: Create event bus, dispatcher
│   └── observability/
│       └── PinoLogger.ts                # Messaging-specific logger
│
├── loggin/
│   └── PinoLogger.ts                    # Adapter: Logger → Pino
│       - Structured logging
│       - Pretty-print in dev
│       - JSON in production
│
├── http/
│   ├── server.ts                        # Fastify server setup
│   ├── controllers/
│   │   └── OrderController.ts           # HTTP → Use Cases adapter
│   │       - POST /orders
│   │       - POST /orders/:id/items
│   │       - POST /orders/:id/confirm
│   │       - GET /orders
│   │       - GET /orders/:id
│   │
│   └── StaticPricingService.ts          # Adapter: PricingService → static catalog
│       - In-memory price lookup
│       - 4 products, 4 currencies
│
└── adapters/
    └── SystemClock.ts                   # Adapter: Clock → Date.now()
```

#### Adapter Example:

```typescript
// Infrastructure implements the port
export class PostgresOrderRepository implements OrderRepository {
  constructor(private pool: Pool) {}

  async save(order: Order): Promise<Result<void, string>> {
    // Convert domain entity to database rows
    await this.pool.query(
      'INSERT INTO orders (id, currency, status) VALUES ($1, $2, $3)',
      [order.id, order.currency.code, order.status.value]
    );
    return ok(undefined);
  }
}
```

### 4. HTTP Layer (Delivery Mechanism)

**Location:** `src/infrastructure/http/`

The outermost layer that handles HTTP requests/responses.

#### Responsibilities:
- Receive HTTP requests
- Validate request format
- Call appropriate use cases
- Transform results to HTTP responses
- Handle HTTP errors

#### Components:

```
src/infrastructure/http/
├── server.ts                     # Fastify setup
│   - Create Fastify instance
│   - Register global error handler
│   - Register routes
│   - Health check endpoint
│
└── controllers/
    └── OrderController.ts        # REST API endpoints
        - createOrder()           # POST /orders
        - addItemToOrder()        # POST /orders/:id/items
        - confirmOrder()          # POST /orders/:id/confirm
        - getOrder()              # GET /orders/:id
        - listOrders()            # GET /orders
```

### 5. Composition Root

**Location:** `src/composition/`

Wires everything together. The **only place** where concrete implementations are instantiated.

#### Components:

```
src/composition/
├── config.ts                     # Environment validation with Zod
│   - NODE_ENV
│   - PORT
│   - DATABASE_URL
│   - USE_INMEMORY
│
├── container.ts                  # Dependency Injection Container
│   - buildContainer()
│       1. Check USE_INMEMORY flag
│       2. Instantiate repositories (PostgreSQL or in-memory)
│       3. Instantiate services (pricing, event bus, logger)
│       4. Instantiate use cases with dependencies
│       5. Return Dependencies object
│       6. Export cleanup() function
│
└── main.ts                       # Application entry point
    - Load environment variables
    - Build dependency container
    - Build HTTP server
    - Start listening
    - Setup graceful shutdown handlers
```

#### Dependency Injection:

```typescript
export function buildContainer(): Dependencies {
  // Environment-based switching
  if (config.USE_INMEMORY) {
    orderRepository = new InMemoryOrderRepository();
    eventBus = new InMemoryEventBus();
  } else {
    orderRepository = DatabaseFactory.createOrderRepository();
    eventBus = MessagingFactory.getInMemoryEventBus();
  }

  // Pure dependencies
  const pricingService = new StaticPricingService();
  const clock = new SystemClock();
  const logger = new PinoLogger({ name: 'use-cases' });

  // Inject dependencies into use cases
  const createOrderUseCase = new CreateOrderUseCase(
    orderRepository,
    pricingService,
    eventBus,
    clock,
    logger
  );

  return { orderRepository, createOrderUseCase, ... };
}
```

## Directory Structure

### Complete File Tree with Layer Classification

```
clean-orders-ts/
├── 📘 DOMAIN LAYER
│   └── src/domain/
│       ├── entities/
│       │   ├── Order.ts                    # Aggregate root
│       │   └── OrderItem.ts                # Entity
│       ├── value-objects/
│       │   ├── Currency.ts                 # VO: USD, EUR, MXN, ARS
│       │   ├── Money.ts                    # VO: Amount + Currency
│       │   ├── OrderStatus.ts              # VO: DRAFT, CONFIRMED, FINALIZED
│       │   ├── Quantity.ts                 # VO: 1-10000
│       │   └── SKU.ts                      # VO: Product ID
│       ├── events/
│       │   ├── DomainEvent.ts              # Base interface
│       │   ├── OrderCreated.ts             # Domain event
│       │   ├── ItemAddedToOrder.ts         # Domain event
│       │   └── OrderConfirmed.ts           # Domain event
│       └── errors/
│           ├── InvalidCurrencyError.ts
│           ├── InvalidQuantityError.ts
│           ├── InvalidSKUError.ts
│           └── OrderError.ts
│
├── 📗 APPLICATION LAYER
│   └── src/application/
│       ├── use-cases/
│       │   ├── CreateOrderUseCase.ts       # UC: Create order
│       │   └── AddItemToOrderUseCase.ts    # UC: Add item
│       ├── ports/
│       │   ├── OrderRepository.ts          # Port interface
│       │   ├── PricingService.ts           # Port interface
│       │   ├── EventBus.ts                 # Port interface
│       │   ├── Clock.ts                    # Port interface
│       │   ├── Logger.ts                   # Port interface
│       │   ├── UnitOfWork.ts               # Port interface
│       │   └── ServerDependencies.ts       # Port aggregation
│       ├── dtos/
│       │   ├── CreateOrderDTO.ts           # Input DTO
│       │   └── AddItemToOrderDTO.ts        # Input DTO
│       └── errors/
│           ├── ValidationError.ts
│           ├── NotFoundError.ts
│           ├── ConflictError.ts
│           └── InfraError.ts
│
├── 📙 INFRASTRUCTURE LAYER
│   └── src/infrastructure/
│       ├── database/                       # PostgreSQL adapters
│       │   ├── DatabaseFactory.ts
│       │   ├── PostgresOrderRepository.ts
│       │   └── PostgresUnitOfWork.ts
│       ├── persistence/                    # In-memory adapters
│       │   └── in-memory/
│       │       └── InMemoryOrderRepository.ts
│       ├── messaging/                      # Event bus adapters
│       │   ├── InMemoryEventBus.ts
│       │   ├── OutboxRepository.ts
│       │   ├── OutboxDispatcher.ts
│       │   ├── MessagingFactory.ts
│       │   └── observability/
│       │       └── PinoLogger.ts
│       ├── loggin/                         # Logging adapters
│       │   └── PinoLogger.ts
│       ├── http/                           # HTTP adapters
│       │   ├── server.ts
│       │   ├── controllers/
│       │   │   └── OrderController.ts
│       │   └── StaticPricingService.ts
│       └── adapters/
│           └── SystemClock.ts
│
├── 📕 HTTP/DELIVERY LAYER (part of infrastructure)
│   └── src/infrastructure/http/
│       ├── server.ts                       # Fastify setup
│       └── controllers/
│           └── OrderController.ts          # REST endpoints
│
├── 🔧 COMPOSITION ROOT
│   └── src/composition/
│       ├── config.ts                       # Environment config
│       └── container.ts                    # DI container
│
├── 🚀 ENTRY POINT
│   └── src/main.ts                         # Application startup
│
├── 🗄️ DATABASE
│   └── db/
│       └── migrations/
│           └── 01-init.sql                 # Schema: orders, order_items, outbox
│
├── 🛠️ SCRIPTS
│   └── scripts/
│       ├── migrate.ts                      # Run migrations
│       └── seed.ts                         # Seed database
│
└── 🧪 TESTS
    └── test/
        ├── domain/                         # Unit tests (no deps)
        │   ├── Order.spec.ts
        │   └── Money.spec.ts
        ├── acceptance/                     # Use case tests (in-memory)
        │   ├── CreateOrder.spec.ts
        │   └── AddItemToOrder.spec.ts
        ├── integration/                    # Integration tests (PostgreSQL)
        │   ├── postgres/
        │   │   └── PostgresOrderRepository.spec.ts
        │   └── messaging/
        │       └── OutboxPattern.spec.ts
        ├── e2e/                           # End-to-end HTTP tests
        │   ├── test-helpers.ts
        │   ├── orders.e2e.spec.ts
        │   └── order-items.e2e.spec.ts
        └── contract/                      # API contract tests
            └── order-api.contract.spec.ts
```

## Dependency Flow

### Inward Dependencies (Correct ✅)

```
HTTP Controller
    ↓ depends on
Use Case
    ↓ depends on
Port Interface (defined in Application)
    ↑ implemented by
Repository Adapter (Infrastructure)
```

### Example Flow: Create Order

```
1. HTTP Request
   POST /orders { "currency": "USD" }
   
2. OrderController.createOrder()
   - Validates request
   - Calls use case
   
3. CreateOrderUseCase.execute()
   - Validates DTO
   - Creates Order entity (domain)
   - Calls repository.save()
   - Publishes events
   
4. PostgresOrderRepository.save()
   - Converts entity to SQL
   - Inserts into database
   
5. OutboxRepository.saveEvents()
   - Saves events transactionally
   
6. Return response
   200 OK { "id": "...", "currency": "USD", ... }
```

## Design Patterns

### 1. **Ports and Adapters (Hexagonal Architecture)**

**Ports** (Interfaces in Application Layer):
```typescript
// Application defines the contract
export interface OrderRepository {
  save(order: Order): Promise<Result<void, string>>;
}
```

**Adapters** (Implementations in Infrastructure):
```typescript
// Infrastructure provides implementations
export class PostgresOrderRepository implements OrderRepository { }
export class InMemoryOrderRepository implements OrderRepository { }
```

### 2. **Dependency Injection**

All dependencies are injected via constructor:

```typescript
export class CreateOrderUseCase {
  constructor(
    private orderRepository: OrderRepository,  // Injected port
    private pricingService: PricingService,    // Injected port
    private eventBus: EventBus,                // Injected port
    private clock: Clock,                      // Injected port
    private logger: Logger                     // Injected port
  ) {}
}
```

### 3. **Factory Pattern**

Centralized object creation:

```typescript
// DatabaseFactory manages PostgreSQL connections
DatabaseFactory.getPool();
DatabaseFactory.createOrderRepository();
DatabaseFactory.close();

// MessagingFactory manages event infrastructure
MessagingFactory.getInMemoryEventBus();
MessagingFactory.startDispatcher();
MessagingFactory.close();
```

### 4. **Repository Pattern**

Abstracts data persistence:

```typescript
interface OrderRepository {
  save(order: Order): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<Order | null, string>>;
  findAll(): Promise<Result<Order[], string>>;
}
```

### 5. **Unit of Work Pattern**

Manages transactions:

```typescript
await unitOfWork.execute(async (client) => {
  await repository.save(order, client);
  await outbox.saveEvents(order.events, client);
  // All or nothing - ACID transaction
});
```

### 6. **Transactional Outbox Pattern**

Guarantees event publishing:

```
1. User action → Save entity + events in same transaction
2. OutboxDispatcher polls outbox table
3. Publish events to message broker
4. Mark as published
```

### 7. **Domain Events**

Decouple business logic:

```typescript
// Domain emits events
order.addItem(...);
// Event: ItemAddedToOrder

// Application publishes events
await eventBus.publishBatch(order.events);
```

### 8. **Value Objects**

Enforce invariants:

```typescript
// Cannot create invalid quantity
const qty = Quantity.create(150); // Ok
const qty = Quantity.create(0);   // Error
const qty = Quantity.create(11000); // Error
```

## How to Test the Application

### Test Pyramid

```
           /\
          /  \
         / E2E \                  ← Few, slow, realistic
        /______\
       /        \
      /Integration\               ← Some, medium speed
     /____________\
    /              \
   /  Unit Tests    \             ← Many, fast, isolated
  /__________________\
```

### 1. Unit Tests (Domain Layer)

**Location:** `test/domain/`
**Speed:** ⚡ Very Fast
**Dependencies:** None

```bash
npm run test:unit
```

Test domain entities and value objects in isolation:

```typescript
// test/domain/Order.spec.ts
describe('Order', () => {
  it('should create order in DRAFT status', () => {
    const currency = Currency.create('USD').unwrap();
    const order = Order.create('order-1', currency);
    
    expect(order.status).toBe('DRAFT');
    expect(order.items).toHaveLength(0);
  });

  it('should reject item with wrong currency', () => {
    const order = Order.create('order-1', Currency.create('USD').unwrap());
    const price = Money.create(100, Currency.create('EUR').unwrap()).unwrap();
    
    expect(() => order.addItem(sku, qty, price)).toThrow('Currency mismatch');
  });
});
```

### 2. Acceptance Tests (Use Cases)

**Location:** `test/acceptance/`
**Speed:** ⚡⚡ Fast
**Dependencies:** In-memory adapters

```bash
npm run test:unit  # Includes acceptance tests
```

Test use cases with in-memory implementations:

```typescript
// test/acceptance/CreateOrder.spec.ts
describe('CreateOrderUseCase', () => {
  let useCase: CreateOrderUseCase;
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
    const pricingService = new StaticPricingService();
    const eventBus = new InMemoryEventBus();
    const clock = new SystemClock();
    const logger = new PinoLogger({ level: 'silent' });
    
    useCase = new CreateOrderUseCase(
      repository,
      pricingService,
      eventBus,
      clock,
      logger
    );
  });

  it('should create order successfully', async () => {
    const result = await useCase.execute({
      orderId: 'order-1',
      currency: 'USD'
    });

    expect(result.success).toBe(true);
    const orders = await repository.findAll();
    expect(orders.unwrap()).toHaveLength(1);
  });
});
```

### 3. Integration Tests (Infrastructure Layer)

**Location:** `test/integration/`
**Speed:** ⚡⚡⚡ Slower (uses PostgreSQL)
**Dependencies:** Docker PostgreSQL

```bash
# Start PostgreSQL first
npm run db:up

# Run integration tests
npm run test:integration
```

Test repository with real database:

```typescript
// test/integration/postgres/PostgresOrderRepository.spec.ts
describe('PostgresOrderRepository', () => {
  let repository: PostgresOrderRepository;

  beforeEach(async () => {
    await DatabaseFactory.clearDatabase();
    repository = DatabaseFactory.createOrderRepository();
  });

  it('should save and retrieve order', async () => {
    const order = Order.create('order-1', Currency.create('USD').unwrap());
    
    await repository.save(order);
    const found = await repository.findById('order-1');
    
    expect(found.unwrap()?.id).toBe('order-1');
  });
});
```

### 4. E2E Tests (HTTP Layer)

**Location:** `test/e2e/`
**Speed:** ⚡⚡⚡ Slower (spins up server + database)
**Dependencies:** PostgreSQL + Fastify server

```bash
# Start PostgreSQL first
npm run db:up
npm run db:migrate

# Run E2E tests (in separate terminal)
npm run test:e2e
```

Test complete HTTP request-response flows:

```typescript
// test/e2e/orders.e2e.spec.ts
describe('Orders E2E Tests', () => {
  let server: TestServer;
  let client: E2EClient;

  beforeAll(async () => {
    server = await startTestServer();
    client = new E2EClient(server.url);
  });

  afterAll(async () => {
    await server.cleanup();
  });

  it('should create order via HTTP', async () => {
    const { status, body } = await client.post('/orders', {
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
    });

    expect(status).toBe(201);
    expect(body).toHaveProperty('id');
  });
});
```

### 5. Contract Tests (API Schema Validation)

**Location:** `test/contract/`
**Speed:** ⚡⚡⚡ Slower (uses server + database)
**Dependencies:** PostgreSQL + Fastify server + Zod

```bash
# Start PostgreSQL first
npm run db:up
npm run db:migrate

# Run contract tests
npm run test:contract
```

Validate API responses match expected schemas:

```typescript
// test/contract/order-api.contract.spec.ts
const OrderSchema = z.object({
  id: z.string().uuid(),
  customerName: z.string().min(1),
  customerEmail: z.string().email(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'FINALIZED']),
  items: z.array(z.object({
    productName: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
  })),
});

it('should return response matching Order schema', async () => {
  const { body } = await client.get(`/orders/${orderId}`);
  
  const result = OrderSchema.safeParse(body);
  expect(result.success).toBe(true);
});
```

### 6. Manual API Testing

#### Option A: Separate Terminal

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Test API
curl http://localhost:3000/health
curl http://localhost:3000/orders
```

#### Option B: Use Test Script

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Run test script
.\test-api.ps1
```

### Test Coverage

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit          # Domain + Acceptance
npm run test:integration   # PostgreSQL
npm run test:e2e          # HTTP end-to-end
npm run test:contract     # API schema validation
npm run test:all          # All test types

# Run with coverage
npm run test:coverage
```

**Comprehensive Test Suite:**

- **Domain Tests**: 46 tests (entities, value objects)
- **Acceptance Tests**: 12 tests (use cases with in-memory)
- **Integration Tests**: 16 tests (PostgreSQL + outbox)
- **E2E Tests**: HTTP request-response flows
- **Contract Tests**: API schema validation

## Example Flows

### Flow 1: Create Order with Items

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ POST /orders { currency: "USD" }
     ↓
┌────────────────┐
│ OrderController│
│  .createOrder()│
└────┬───────────┘
     │
     ↓
┌──────────────────────┐
│ CreateOrderUseCase   │
│  .execute()          │
│                      │
│  1. Validate DTO     │
│  2. Create Order     │◄───┐
│  3. Save Order       │    │ Domain Layer
│  4. Publish Events   │    │ (Business Logic)
└──────┬───────────────┘    │
       │                    │
       ↓                    │
┌──────────────────────┐    │
│ OrderRepository      │    │
│  .save()             │    │
└──────┬───────────────┘    │
       │                    │
       ↓                    │
┌──────────────────────┐    │
│ PostgreSQL           │    │
│  INSERT INTO orders  │    │
│  INSERT INTO outbox  │    │
└──────────────────────┘    │
                            │
┌──────────────────────┐    │
│ OutboxDispatcher     │    │
│  (background worker) │    │
│                      │    │
│  1. Poll outbox      │    │
│  2. Publish events   │    │
│  3. Mark published   │    │
└──────────────────────┘    │
                            │
                            │
       │ POST /orders/order-1/items
       │ { sku: "LAPTOP-PRO-15", quantity: 2 }
       ↓
┌────────────────┐
│ OrderController│
│ .addItemToOrder│
└────┬───────────┘
     │
     ↓
┌─────────────────────────┐
│ AddItemToOrderUseCase   │
│  .execute()             │
│                         │
│  1. Validate DTO        │
│  2. Load Order          │◄──┐
│  3. Get Price           │   │
│  4. order.addItem()     │───┘ Domain method
│  5. Save Order          │
│  6. Publish Events      │
└─────────────────────────┘
```

### Flow 2: Environment-Based Switching

```
Application Startup
        │
        ↓
    config.ts
        │
        ↓
   USE_INMEMORY?
        │
    ┌───┴───┐
    │       │
   YES     NO
    │       │
    │       ↓
    │   DatabaseFactory
    │       │
    │       ├─→ PostgresOrderRepository
    │       ├─→ PostgresUnitOfWork
    │       └─→ OutboxRepository
    │
    ↓
InMemoryOrderRepository
InMemoryEventBus
    │
    └─→ No database required
        Fast for testing
```

### Flow 3: Graceful Shutdown

```
SIGINT/SIGTERM received (Ctrl+C)
        │
        ↓
   cleanup()
        │
        ├─→ 1. Close HTTP Server
        │       │
        │       └─→ Stop accepting new requests
        │           Wait for ongoing requests (10s timeout)
        │
        ├─→ 2. Close MessagingFactory
        │       │
        │       └─→ Stop OutboxDispatcher
        │           Finish current batch
        │
        └─→ 3. Close DatabaseFactory
                │
                └─→ Close connection pool
                    Drain active connections
                    
        ↓
   Process exits cleanly
   No connection leaks
   No data loss
```

## Key Takeaways

### ✅ Benefits of This Architecture

1. **Testability**: Each layer tested independently
2. **Flexibility**: Swap PostgreSQL for MongoDB without touching business logic
3. **Maintainability**: Changes isolated to specific layers
4. **Team Scalability**: Teams can work on different layers simultaneously
5. **Technology Independence**: Not locked to Fastify, PostgreSQL, or Pino

### 🎯 When to Use Clean Architecture

- ✅ Long-lived applications
- ✅ Complex business logic
- ✅ Multiple delivery mechanisms (REST, GraphQL, CLI)
- ✅ Frequent technology changes
- ✅ Large teams

### ⚠️ When NOT to Use

- ❌ Simple CRUD applications
- ❌ Prototypes or MVPs
- ❌ Small applications (<10 endpoints)
- ❌ Applications with no complex business logic

### 📚 Further Reading

- **Clean Architecture** by Robert C. Martin
- **Domain-Driven Design** by Eric Evans
- **Implementing Domain-Driven Design** by Vaughn Vernon
- **Hexagonal Architecture** by Alistair Cockburn

---

**Author:** Membrive92  
**Project:** Order Microservice  
**Architecture:** Clean Architecture + DDD + Hexagonal Architecture
