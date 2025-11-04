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

```bash
# Install dependencies
npm install

# Run tests
npm test

# Start development server
npm run dev
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
│   ├── dto/                # Data Transfer Objects
│   └── errors.ts           # Application-level errors
├── infrastructure/         # External implementations
│   ├── persistence/        # Persistence adapters
│   │   └── in-memory/      # In-memory repositories
│   ├── http/               # HTTP adapters
│   │   └── controllers/    # HTTP controllers
│   └── messaging/          # Messaging/event bus adapters
├── composition/            # Composition root & DI wiring
└── shared/                 # Cross-cutting utilities/types
```
