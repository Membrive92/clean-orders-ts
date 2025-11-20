# Order Microservice

A clean architecture implementation of an order management microservice.

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

- **InMemory Repository**: In-memory implementation of order repository
- **Static Pricing**: Simple pricing service with static prices
- **No-op Event Bus**: Event bus implementation for testing/development

### HTTP Layer

REST API endpoints:

- **Fastify**: Minimal endpoints using Fastify framework for order operations

### Composition Root

- **container.ts**: Dependency injection container that wires all components together

## Testing

The project includes:

- **Domain Tests**: Unit tests for domain entities and value objects
- **Acceptance Tests**: End-to-end tests for use cases

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

| Command | Description |
|---------|-------------|
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Populate database with sample data |
| `npm run db:setup` | Start DB and seed (quick setup) |
| `npm run db:reset` | Reset database completely |
| `npm run dev` | Start dev server with PostgreSQL |
| `npm run dev:inmemory` | Start dev server without database |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm run test:unit` | Run unit & acceptance tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:watch` | Run tests in watch mode |

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
  "currency": "USD"  # USD, EUR, MXN, ARS
}
```

#### Add item to order

```bash
POST /orders/:orderId/items
Content-Type: application/json

{
  "sku": "LAPTOP-PRO-15",
  "quantity": 2
}
```

#### Confirm order

```bash
POST /orders/:orderId/confirm
```

### Example with PowerShell

```powershell
# Create order
$body = @{ currency = "USD" } | ConvertTo-Json
$order = Invoke-RestMethod -Uri "http://localhost:3000/orders" -Method POST -Body $body -ContentType "application/json"

# Add item
$itemBody = @{ sku = "LAPTOP-PRO-15"; quantity = 2 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:3000/orders/$($order.id)/items" -Method POST -Body $itemBody -ContentType "application/json"

# Confirm order
Invoke-RestMethod -Uri "http://localhost:3000/orders/$($order.id)/confirm" -Method POST
```

### Example with curl

```bash
# Create order
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"currency":"USD"}'

# Add item
curl -X POST http://localhost:3000/orders/{orderId}/items \
  -H "Content-Type: application/json" \
  -d '{"sku":"LAPTOP-PRO-15","quantity":2}'

# Confirm order
curl -X POST http://localhost:3000/orders/{orderId}/confirm
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

The application handles shutdown signals gracefully:

- **SIGTERM/SIGINT**: Stops accepting new requests, closes connections
- **uncaughtException**: Logs error and performs cleanup
- **unhandledRejection**: Logs error and performs cleanup

Press `Ctrl+C` to trigger graceful shutdown:

```
[INFO] Starting graceful shutdown...
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
```
