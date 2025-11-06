# Dominio de Órdenes - Arquitectura Limpia

## 📋 Descripción General

Se ha implementado el dominio de un sistema de gestión de órdenes siguiendo **Clean Architecture** con énfasis en **Domain-Driven Design (DDD)**.

### Archivos creados:

1. **`src/domain/value-objects/index.ts`** - Value Objects con invariantes
2. **`src/domain/entities/Order.ts`** - Entidad Order (Aggregate Root)
3. **`src/domain/events/index.ts`** - Eventos de Dominio
4. **`src/domain/Order.spec.ts`** - Tests (14 tests en verde ✓)

---

## 💎 Value Objects (Invariantes Encapsulados)

### **Currency**
- Monedas válidas: USD, EUR, MXN, ARS
- No permite monedas inválidas
- Inmutable y comparable

### **SKU** (Stock Keeping Unit)
- No vacío (1-50 caracteres)
- Convierte a mayúsculas automáticamente
- Trimea espacios en blanco

### **Quantity**
- Entero positivo (1-10000)
- Rechaza cero, negativos, decimales
- Operación `add()` crea nueva instancia

### **Money**
- Monto + Moneda (patrón Value Object compuesto)
- Máximo 2 decimales
- No permite sumar monedas distintas
- Método `multiply()` para cálculos de líneas

### **OrderLineItem**
- Composición: SKU + Quantity + Money (unitPrice)
- Calcula subtotal automáticamente
- Valor object, no mutable

---

## 🏗️ Entidad Order (Aggregate Root)

### **Responsabilidades:**
1. ✅ Crear órdenes con validación
2. ✅ Agregar items (validando moneda, duplicados, estado)
3. ✅ Calcular total
4. ✅ Gestionar transiciones de estado (DRAFT → CONFIRMED → FINALIZED)
5. ✅ Recolectar eventos de dominio

### **Estados:**
- `DRAFT` - Recién creada, permite agregar items
- `CONFIRMED` - Confirmada, items bloqueados
- `FINALIZED` - Completada
- `CANCELLED` - Cancelada

### **Métodos clave:**
```ts
// Crear
Order.create(id: string, currency: Currency): Result<Order, string>

// Operaciones
order.addItem(sku: SKU, qty: Quantity, price: Money): Result<void, string>
order.getTotal(): Result<Money, string>
order.confirm(): Result<void, string>
order.finalize(): Result<void, string>
order.cancel(): Result<void, string>

// Eventos
order.getDomainEvents(): DomainEvent[]
order.clearDomainEvents(): void
```

---

## 📡 Eventos de Dominio

### **OrderCreated**
- Se emite al crear una orden
- Captura: id y timestamp

### **ItemAdded**
- Se emite cada vez que se agrega un item
- Captura: sku, quantity, unitPrice

### **OrderTotalCalculated**
- Se emite al calcular el total
- Captura: total, moneda

### **OrderFinalized**
- Se emite al finalizar la orden
- Captura: timestamp

---

## ✅ Invariantes Implementados

| Invariante | Value Object | Enforcement |
|-----------|--------------|------------|
| Moneda válida | Currency | Constructor privado + `create()` |
| SKU no vacío | SKU | Validación en `create()` |
| Cantidad positiva | Quantity | Rango 1-10000 |
| Monto válido | Money | 2 decimales máx, > 0 |
| Monedas homogéneas | Order | Validación en `addItem()` |
| SKUs únicos | Order | Búsqueda ante de agregar |
| Estado válido | Order | Transiciones permitidas |

---

## 🔄 Patrón Result para Manejo de Errores

Todos los métodos retornan `Result<T, E>` (sin excepciones):

```ts
type Result<T, E> = 
  | { success: true; data: T; value: T; isSuccess: true; isFailure: false }
  | { success: false; error: E; isSuccess: false; isFailure: true }
```

**Ventajas:**
- ✅ Errores explícitos en el tipo
- ✅ Sin excepciones sorpresa
- ✅ Fácil de testear
- ✅ Composable con `map` / `flatMap`

---

## 🧪 Tests (14 casos cubiertos)

```
✓ Currency Value Object (2 tests)
  - creates a valid currency
  - rejects invalid currency

✓ SKU Value Object (2 tests)
  - creates a valid SKU
  - rejects empty SKU

✓ Quantity Value Object (2 tests)
  - creates a valid quantity
  - rejects zero or negative quantity

✓ Money Value Object (2 tests)
  - creates valid money
  - rejects negative amount

✓ Order Aggregate Root (6 tests)
  - creates a new order with DRAFT status
  - adds an item to the order
  - calculates order total correctly
  - confirms order
  - finalizes order
  - prevents duplicate SKUs
```

---

## 🎯 Próximos Pasos

1. **Application Layer**: Casos de uso (CreateOrderUseCase, AddItemUseCase)
2. **Ports**: Interfaces para repositorio, servicio de precios
3. **Infrastructure**: Implementaciones (InMemoryRepository, etc)
4. **HTTP Controllers**: Endpoints REST

---

## 📦 Sin dependencias externas

- ✅ Puro TypeScript
- ✅ Sin frameworks en dominio
- ✅ Sin I/O (BD, HTTP)
- ✅ Fácil de testear y reutilizar
