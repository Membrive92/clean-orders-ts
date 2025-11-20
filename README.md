# Order Microservice

A production-ready clean architecture implementation of an order management microservice with PostgreSQL, event sourcing, and comprehensive testing.

## Key Features

✅ **Clean Architecture** - Clear separation of concerns across domain, application, and infrastructure layers  
✅ **PostgreSQL Integration** - Production database with connection pooling and migrations  
✅ **In-Memory Mode** - Fast testing without database dependencies  
✅ **Transactional Outbox Pattern** - Reliable event publishing with exactly-once semantics  
✅ **Graceful Shutdown** - Proper resource cleanup and signal handling  
✅ **Structured Logging** - Pino logger with development and production modes  
✅ **Type Safety** - Full TypeScript with strict mode  
✅ **Comprehensive Testing** - 74 tests covering domain, application, and integration  
✅ **Environment-Based Configuration** - Easy switching between implementations  
✅ **Domain Events** - Event-driven architecture with domain event publishing  

## Tech Stack

- **Runtime**: Node.js 18+ with ES Modules
- **Language**: TypeScript 5.6+ (strict mode)
- **Web Framework**: Fastify 4.x (fast, low overhead)
- **Database**: PostgreSQL 16 with pg driver
- **Logging**: Pino (high-performance structured logging)
- **Testing**: Vitest 2.x (fast unit and integration tests)
- **Validation**: Zod (runtime schema validation)
- **Containerization**: Docker Compose

## Architecture Overview

This project follows Clean Architecture principles with clear separation of concerns across different layers.

### Domain Layer

Core business logic and entities:

- **Order**: Aggregate root representing a customer order
- **Price**: Value object for pricing information
- **SKU**: Value object for product identification
- **Quantity**: Value object for item quantities
- **Domain Events**: Events emitted during order lifecycle

### Application Layer

Use cases and application logic:

- **CreateOrder**: Use case for creating new orders
- **AddItemToOrder**: Use case for adding items to existing orders
- **Ports**: Interfaces defining contracts for external dependencies
- **DTOs**: Data Transfer Objects for communication between layers

### Infrastructure Layer

External implementations:

- **PostgreSQL Repository**: Production-ready implementation with connection pooling
- **InMemory Repository**: Fast in-memory implementation for testing
- **Static Pricing Service**: Static pricing catalog for development
- **Outbox Pattern**: Transactional outbox for reliable event publishing
- **Event Bus**: In-memory event bus for domain events
- **Pino Logger**: Structured logging with development and production modes
- **DatabaseFactory**: Singleton for managing PostgreSQL connections
- **MessagingFactory**: Factory for event bus and outbox dispatcher

### HTTP Layer

REST API with Fastify:

- **Fastify Server**: Fast HTTP server with automatic error handling
- **OrderController**: RESTful endpoints for order operations
- **Global Error Handler**: Centralized error handling for all routes
- **Health Check**: Endpoint for monitoring service availability

### Composition Root

- **container.ts**: Dependency injection container with environment-based switching
- **config.ts**: Environment validation with Zod
- **main.ts**: Application entry point with graceful shutdown

## Testing

The project includes comprehensive test coverage (74 tests):

- **Domain Tests**: Unit tests for entities (Order) and value objects (Money, SKU, Quantity, Currency)
- **Acceptance Tests**: End-to-end tests for use cases (CreateOrder, AddItemToOrder)
- **Integration Tests**: PostgreSQL repository tests and Outbox pattern tests
- **All tests pass**: ✅ 74/74 passing with both PostgreSQL and in-memory implementations

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- PostgreSQL 16 (via Docker)

### Installation

```bash
# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54320/clean_orders
PRICING_BASE_URL=https://localhost:4000
USE_INMEMORY=false  # true for in-memory, false for PostgreSQL
```

### Database Setup

#### Quick Setup (Recommended)

```bash
# Start PostgreSQL and seed database in one command
npm run db:setup
```

#### Step by Step

##### 1. Start PostgreSQL with Docker

```bash
npm run db:up
```

This will:
- Start PostgreSQL on port 54320
- Automatically run migrations from `db/migrations/`
- Create tables: `orders`, `order_items`, `outbox`

##### 2. Seed Database (Optional)

Populate the database with sample data:

```bash
npm run db:seed
```

This creates:
- 3 sample orders (DRAFT, CONFIRMED, FINALIZED)
- 4 order items

##### 3. Manual Migrations

To run migrations manually (if not using Docker auto-init):

```bash
npm run db:migrate
```

##### 4. Reset Database

To reset everything and start fresh:

```bash
npm run db:reset
```

### Running the Application

#### Development Mode with PostgreSQL

```bash
npm run dev
```

Server starts at `http://localhost:3000`

#### Development Mode (In-Memory, No Database)

```bash
npm run dev:inmemory
```

Runs with in-memory repositories, no PostgreSQL required.

#### Production Mode

```bash
npm run build
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run only unit and acceptance tests
npm run test:unit

# Run only integration tests (requires PostgreSQL)
npm run test:integration

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Quick Start Guide

### Complete Setup from Scratch

```bash
# 1. Clone and install
git clone <repository-url>
cd clean-orders-ts
npm install

# 2. Setup environment
cp .env.example .env  # Edit if needed

# 3. Start database and seed data
npm run db:setup

# 4. Run tests
npm test

# 5. Start development server
npm run dev

# 6. Test the API (in another terminal)
curl http://localhost:3000/health
curl http://localhost:3000/orders
```

### Available npm Scripts

#### Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:up` | Start PostgreSQL container (port 54320) |
| `npm run db:down` | Stop and remove PostgreSQL container |
| `npm run db:migrate` | Run database migrations manually |
| `npm run db:seed` | Populate database with 3 orders and 4 items |
| `npm run db:setup` | **Quick setup**: Start DB and seed in one command |
| `npm run db:reset` | Reset database: down, up, wait, migrate |

#### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with PostgreSQL (hot reload) |
| `npm run dev:inmemory` | Start dev server with in-memory repositories |
| `npm run build` | Compile TypeScript to JavaScript (dist/) |
| `npm start` | Start production server from dist/ |

#### Testing Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all 74 tests (domain + acceptance + integration) |
| `npm run test:unit` | Run only unit and acceptance tests (no DB) |
| `npm run test:integration` | Run only integration tests (requires PostgreSQL) |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:watch` | Run tests in watch mode for development |

#### Worker Commands

| Command | Description |
|---------|-------------|
| `npm run worker:outbox` | Start outbox dispatcher worker (polls and publishes events) |

## API Endpoints

### Health Check

```bash
GET /health
```

### Orders

#### List all orders

```bash
GET /orders
```

#### Get order by ID

```bash
GET /orders/:orderId
```

#### Create new order

```bash
POST /orders
Content-Type: application/json

{
  "orderId": "order-123",      # Optional: auto-generated if not provided
  "currency": "USD"            # Required: USD, EUR, MXN, ARS
}
```

Response:
```json
{
  "id": "order-123",
  "currency": "USD",
  "status": "DRAFT",
  "items": [],
  "total": { "amount": 0, "currency": "USD" }
}
```

#### Add item to order

```bash
POST /orders/:orderId/items
Content-Type: application/json

{
  "sku": "LAPTOP-PRO-15",      # Required: Product SKU
  "quantity": 2                # Required: 1-10000
}
```

Response:
```json
{
  "id": "order-123",
  "currency": "USD",
  "status": "DRAFT",
  "items": [
    {
      "sku": "LAPTOP-PRO-15",
      "quantity": 2,
      "unitPrice": { "amount": 1299.99, "currency": "USD" }
    }
  ],
  "total": { "amount": 2599.98, "currency": "USD" }
}
```

#### Confirm order

```bash
POST /orders/:orderId/confirm
```

Response:
```json
{
  "id": "order-123",
  "status": "CONFIRMED",
  ...
}
```

### Available Products (Static Pricing)

| SKU | USD | EUR | MXN | ARS |
|-----|-----|-----|-----|-----|
| `LAPTOP-PRO-15` | $1,299.99 | €1,199.99 | $25,999 | $520,000 |
| `MOUSE-WIRELESS` | $29.99 | €27.50 | $599 | $12,000 |
| `KEYBOARD-MECHANICAL` | $149.99 | €139.99 | $2,999 | $60,000 |
| `MONITOR-4K-27` | $449.99 | €399.99 | $8,999 | $180,000 |

### Example with PowerShell

**⚠️ Important:** Run these commands in a **separate PowerShell terminal** (not the same one running the server) to avoid signal conflicts.

```powershell
# Create order with auto-generated ID
$body = @{ currency = "USD" } | ConvertTo-Json
$order = Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method POST -Body $body -ContentType "application/json"
Write-Host "Created order: $($order.id)"

# Add multiple items
$item1 = @{ sku = "LAPTOP-PRO-15"; quantity = 1 } | ConvertTo-Json
$order = Invoke-RestMethod -Uri "http://localhost:3000/orders/$($order.id)/items" -Method POST -Body $item1 -ContentType "application/json"

$item2 = @{ sku = "MOUSE-WIRELESS"; quantity = 2 } | ConvertTo-Json
$order = Invoke-RestMethod -Uri "http://localhost:3000/orders/$($order.id)/items" -Method POST -Body $item2 -ContentType "application/json"

Write-Host "Order total: $($order.total.amount) $($order.total.currency)"

# Confirm order
$confirmedOrder = Invoke-RestMethod -Uri "http://localhost:3000/orders/$($order.id)/confirm" -Method POST
Write-Host "Order status: $($confirmedOrder.status)"
```

### Example with curl

```bash
# Health check
curl http://localhost:3000/health

# List all orders
curl http://localhost:3000/orders

# Create order
ORDER_ID=$(curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD"}' | jq -r '.id')

echo "Created order: $ORDER_ID"

# Add items
curl -X POST http://localhost:3000/orders/$ORDER_ID/items \
  -H "Content-Type: application/json" \
  -d '{"sku":"LAPTOP-PRO-15","quantity":1}'

curl -X POST http://localhost:3000/orders/$ORDER_ID/items \
  -H "Content-Type: application/json" \
  -d '{"sku":"MOUSE-WIRELESS","quantity":2}'

# Get order details
curl http://localhost:3000/orders/$ORDER_ID | jq

# Confirm order
curl -X POST http://localhost:3000/orders/$ORDER_ID/confirm | jq
```

## Database Migrations

### Creating a New Migration

1. Create a new SQL file in `db/migrations/` with format `##-description.sql`:

```sql
-- db/migrations/02-add-customer-field.sql
ALTER TABLE orders ADD COLUMN customer_email VARCHAR(255);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
```

2. Run the migration:

```bash
npx tsx scripts/migrate.ts
```

Or restart Docker to auto-run:

```bash
docker-compose restart
```

### Migration Best Practices

- Use sequential numbering: `01-`, `02-`, `03-`
- Make migrations idempotent with `IF NOT EXISTS`
- Add indexes for frequently queried columns
- Include rollback instructions in comments

## Transactional Outbox Pattern

This project implements the Transactional Outbox pattern for reliable event publishing:

1. **Domain events** are saved to the `outbox` table in the same transaction as entity changes
2. **OutboxDispatcher** polls for unpublished events
3. Events are published to the message broker
4. Successfully published events are marked with `published_at` timestamp

### Monitoring Outbox

```typescript
import { DatabaseFactory } from './infrastructure/database/DatabaseFactory.js';

// Get outbox statistics
const stats = await DatabaseFactory.getDatabaseStats();
console.log(stats);
// { orders: 3, orderItems: 4, outbox: 10, outboxUnpublished: 2 }
```

## Graceful Shutdown

The application handles shutdown signals gracefully to prevent data loss and connection leaks:

### Signal Handling

- **SIGTERM/SIGINT (Ctrl+C)**: Initiates graceful shutdown
  1. Stops accepting new HTTP requests
  2. Waits for ongoing requests to complete (10s timeout)
  3. Closes MessagingFactory (event bus and outbox)
  4. Closes DatabaseFactory (PostgreSQL connection pool)
  5. Exits cleanly

- **uncaughtException**: Logs critical errors, only exits on system failures (EADDRINUSE, EACCES, etc.)
- **unhandledRejection**: Logs warnings but continues execution (non-critical)

### Error Handling Strategy

The application differentiates between:
- **Critical system errors**: Port in use, permission denied → exits
- **Application errors**: HTTP errors, domain validation → logs and continues
- **Route errors**: Caught by Fastify global error handler → returns proper HTTP response

Press `Ctrl+C` to trigger graceful shutdown:

```
[INFO] SIGINT received, shutting down gracefully
[INFO] Starting graceful shutdown...
[INFO] Closing HTTP server...
[INFO] HTTP server closed
📨 Closing messaging resources...
✅ Messaging resources closed
🔌 Closing database connections...
✅ Database connections closed
[INFO] Graceful shutdown completed
```

## Logging

Structured logging with Pino:

- **Development**: Pretty-printed logs with `pino-pretty`
- **Production**: JSON logs for log aggregation
- **Log levels**: `debug`, `info`, `warn`, `error`

Example log output:

```
[2025-11-20 22:42:22.155] INFO (main): Starting application...
[2025-11-20 22:42:22.164] INFO (container): Using PostgreSQL implementations
    databaseUrl: "postgresql://postgres:***@127.0.0.1:54320/clean_orders"
```

## Project Structure

```
src/
├── domain/                 # Core business logic
│   ├── entities/           # Aggregate roots and entities
│   ├── value-objects/      # Value objects
│   ├── events/             # Domain events
│   └── errors/             # Domain-specific errors
├── application/            # Application layer
│   ├── use-cases/          # Use case orchestrations
│   ├── ports/              # Interfaces to external systems
│   └── dto/                # Data Transfer Objects
├── infrastructure/         # External implementations
│   ├── database/           # PostgreSQL implementation
│   │   ├── DatabaseFactory.ts
│   │   ├── PostgresOrderRepository.ts
│   │   └── PostgresUnitOfWork.ts
│   ├── persistence/        # In-memory implementations
│   ├── messaging/          # Event bus & Outbox pattern
│   ├── loggin/             # Pino logger
│   └── http/               # Fastify server & controllers
├── composition/            # Dependency injection
│   ├── container.ts        # DI container with env switching
│   └── config.ts           # Environment configuration
└── main.ts                 # Application entry point
db/
└── migrations/             # SQL migration files
scripts/
├── migrate.ts              # Run migrations
└── seed.ts                 # Seed database
test/
├── domain/                 # Unit tests for entities and VOs
├── acceptance/             # Use case tests
└── integration/            # PostgreSQL and outbox tests
```

## Troubleshooting

### Port 5432 Already in Use

If you have a local PostgreSQL instance running on port 5432, this project uses port **54320** to avoid conflicts:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54320/clean_orders
```

### Server Closes Unexpectedly

Make sure to run API tests (curl, Invoke-RestMethod) in a **separate terminal window**. Running them in the same terminal as the server can send signals that trigger shutdown.

### Database Connection Errors

```bash
# Check if PostgreSQL is running
docker ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart database
npm run db:down
npm run db:up
```

### Migration Errors

```bash
# Reset database completely
npm run db:reset

# Or manually:
npm run db:down
docker volume rm clean-orders-ts_postgres_data
npm run db:up
```

### Tests Failing

```bash
# Ensure PostgreSQL is running for integration tests
npm run db:up

# Run only unit tests (no DB required)
npm run test:unit

# Check database state
npm run db:seed  # Re-seed if needed
```

### TypeScript Compilation Errors

```bash
# Clean and rebuild
rm -rf dist
npm run build

# Check for type errors
npx tsc --noEmit
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

## License

MIT

## Author

Membrive92
