# Orders Domain - Clean Architecture

## 📋 General Description

The domain of an order management system has been implemented following **Clean Architecture** with emphasis on **Domain-Driven Design (DDD)**.

### Created files:

1. **`src/domain/value-objects/index.ts`** - Value Objects with invariants
2. **`src/domain/entities/Order.ts`** - Order Entity (Aggregate Root)
3. **`src/domain/events/index.ts`** - Domain Events
4. **`test/domain/`** - Tests (46 tests passing ✓)

---

## 💎 Value Objects (Encapsulated Invariants)

### **Currency**
- Valid currencies: USD, EUR, MXN, ARS
- Does not allow invalid currencies
- Immutable and comparable

### **SKU** (Stock Keeping Unit)
- Non-empty (1-50 characters)
- Automatically converts to uppercase
- Trims whitespace

### **Quantity**
- Positive integer (1-10000)
- Rejects zero, negative, decimal values
- `add()` operation creates new instance

### **Money**
- Amount + Currency (composite Value Object pattern)
- Maximum 2 decimal places
- Does not allow adding different currencies
- `multiply()` method for line calculations

### **OrderLineItem**
- Composition: SKU + Quantity + Money (unitPrice)
- Automatically calculates subtotal
- Value object, immutable

---

## 🏗️ Order Entity (Aggregate Root)

### **Responsibilities:**
1. ✅ Create orders with validation
2. ✅ Add items (validating currency, duplicates, state)
3. ✅ Calculate total
4. ✅ Manage state transitions (DRAFT → CONFIRMED → FINALIZED)
5. ✅ Collect domain events

### **States:**
- `DRAFT` - Newly created, allows adding items
- `CONFIRMED` - Confirmed, items locked
- `FINALIZED` - Completed
- `CANCELLED` - Cancelled

### **Key methods:**
```ts
// Create
Order.create(id: string, currency: Currency): Result<Order, string>

// Operations
order.addItem(sku: SKU, qty: Quantity, price: Money): Result<void, string>
order.getTotal(): Result<Money, string>
order.confirm(): Result<void, string>
order.finalize(): Result<void, string>
order.cancel(): Result<void, string>

// Events
order.getDomainEvents(): DomainEvent[]
order.clearDomainEvents(): void
```

---

## 📡 Domain Events

### **OrderCreated**
- Emitted when creating an order
- Captures: id and timestamp

### **ItemAdded**
- Emitted each time an item is added
- Captures: sku, quantity, unitPrice

### **OrderTotalCalculated**
- Emitted when calculating the total
- Captures: total, currency

### **OrderFinalized**
- Emitted when finalizing the order
- Captures: timestamp

---

## ✅ Implemented Invariants

| Invariant | Value Object | Enforcement |
|-----------|--------------|------------|
| Valid currency | Currency | Private constructor + `create()` |
| Non-empty SKU | SKU | Validation in `create()` |
| Positive quantity | Quantity | Range 1-10000 |
| Valid amount | Money | 2 decimals max, > 0 |
| Homogeneous currencies | Order | Validation in `addItem()` |
| Unique SKUs | Order | Search before adding |
| Valid state | Order | Allowed transitions |

---

## 🔄 Result Pattern for Error Handling

All methods return `Result<T, E>` (no exceptions):

```ts
type Result<T, E> = 
  | { success: true; data: T; value: T; isSuccess: true; isFailure: false }
  | { success: false; error: E; isSuccess: false; isFailure: true }
```

**Advantages:**
- ✅ Explicit errors in the type
- ✅ No surprise exceptions
- ✅ Easy to test
- ✅ Composable with `map` / `flatMap`

---

## 🧪 Tests (46 cases covered)

```
✓ Money (Price) Value Object (21 tests)
  - Creation validation, arithmetic operations
  - Edge cases and boundary conditions
  - Currency consistency and immutability

✓ Order Aggregate Root (25 tests)
  - State transitions and business rules
  - Item management and validation
  - Total calculation and currency consistency
  - Domain events and lifecycle management
```

---

## 🎯 Implementation Status

1. ✅ **Application Layer**: Use cases (CreateOrderUseCase, AddItemToOrderUseCase)
2. ✅ **Ports**: Interfaces for repository, pricing service, event bus
3. ✅ **Infrastructure**: Implementations (InMemoryRepository, StaticPricingService, etc)
4. ✅ **HTTP Controllers**: REST endpoints with Fastify
5. ✅ **Composition Root**: Dependency injection container
6. ✅ **Comprehensive Testing**: 58 tests including acceptance tests

---

## 📦 No external dependencies in domain

- ✅ Pure TypeScript
- ✅ No frameworks in domain
- ✅ No I/O (DB, HTTP)
- ✅ Easy to test and reuse
- ✅ Clean Architecture principles enforced
