# Application Layer - Clean Architecture

## 📋 Overview

La capa de aplicación orquesta el dominio con la infraestructura. Es responsable de:

1. Validar inputs del usuario
2. Coordinar operaciones del dominio
3. Persistir datos y publicar eventos
4. Mapear errores a tipos discriminados
5. Mantener la lógica de negocio pura (en el dominio)

## 🚨 Errores - Discriminated Unions

### Estructura

```typescript
type AppErrorType = ValidationError | NotFoundError | ConflictError | InfraError;

// Errores en use cases mappeados a tipos discriminados:
type UseCase Error = 
  | { type: 'VALIDATION_ERROR'; message: string }
  | { type: 'NOT_FOUND_ERROR'; message: string }
  | { type: 'CONFLICT_ERROR'; message: string }
  | { type: 'INFRA_ERROR'; message: string }
```

### Tipos de Error

| Error | Causa | Ejemplo |
|-------|-------|---------|
| `ValidationError` | Input inválido | SKU vacío, currency desconocida |
| `NotFoundError` | Recurso no existe | Orden no encontrada |
| `ConflictError` | Regla de negocio violada | Orden duplicada, no puede agregar items |
| `InfraError` | Fallo de I/O | BD error, API error |

### Uso

```typescript
// En use case
if (!dto.orderId) {
  const error = new ValidationError('orderId required');
  return fail({ type: 'VALIDATION_ERROR', message: error.message });
}

// En handler
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

## 🔌 Puertos (Interfaces)

### OrderRepository

```typescript
interface OrderRepository {
  save(order: Order): Promise<Result<void, string>>;
  findById(id: string): Promise<Result<Order | null, string>>;
  update(order: Order): Promise<Result<void, string>>;
  findAll(limit?, offset?): Promise<Result<Order[], string>>;
}
```

**Responsabilidad:** Persistencia de órdenes (agnóstico de BD)

**Implementaciones posibles:**
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

**Responsabilidad:** Obtener precios de productos

**Implementaciones posibles:**
- HttpPricingService (API externa)
- DatabasePricingService (BD local)
- CachedPricingService (con caché)

### EventBus

```typescript
interface EventBus {
  publish(events: DomainEvent[]): Promise<Result<void, string>>;
  publishSingle(event: DomainEvent): Promise<Result<void, string>>;
  subscribe(eventType: string, handler): void;
  unsubscribe(eventType: string, handler): void;
}
```

**Responsabilidad:** Publicar y suscribirse a eventos de dominio

**Implementaciones posibles:**
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

**Responsabilidad:** Obtener hora actual (abstracción para testing)

**Implementaciones:**
- SystemClock (hora del sistema)
- MockClock (hora fija para tests)

## 📦 DTOs (Data Transfer Objects)

### CreateOrderDTO

```typescript
interface CreateOrderDTO {
  orderId: string;
  currency: string;
}
```

**Origen:** Request HTTP, eventos externos
**Destino:** CreateOrderUseCase

### AddItemToOrderDTO

```typescript
interface AddItemToOrderDTO {
  orderId: string;
  sku: string;
  quantity: number;
}
```

**Origen:** Request HTTP
**Destino:** AddItemToOrderUseCase

## 🎯 Use Cases

### CreateOrderUseCase

**Responsabilidades:**
1. ✅ Validar DTO (orderId, currency)
2. ✅ Crear Currency Value Object
3. ✅ Verificar que orden no existe (consultar repository)
4. ✅ Crear Order en el dominio
5. ✅ Persistir orden (repository.save)
6. ✅ Publicar eventos (eventBus.publish)
7. ✅ Limpiar eventos

**Errores posibles:**
- `VALIDATION_ERROR`: DTO o Value Object inválido
- `CONFLICT_ERROR`: Orden duplicada
- `INFRA_ERROR`: Error de BD o evento bus

**Signature:**
```typescript
execute(dto: CreateOrderDTO): Promise<Result<{ orderId: string }, CreateOrderError>>
```

### AddItemToOrderUseCase

**Responsabilidades:**
1. ✅ Validar DTO (orderId, sku, quantity)
2. ✅ Obtener orden (repository.findById)
3. ✅ Crear SKU Value Object
4. ✅ Crear Quantity Value Object
5. ✅ Obtener precio (pricingService.getPriceForSku)
6. ✅ Crear Money Value Object
7. ✅ Agregar item al dominio (order.addItem)
8. ✅ Persistir orden (repository.update)
9. ✅ Publicar eventos (eventBus.publish)
10. ✅ Limpiar eventos

**Errores posibles:**
- `VALIDATION_ERROR`: DTO, SKU, Quantity o Money inválidos
- `NOT_FOUND_ERROR`: Orden no encontrada
- `CONFLICT_ERROR`: No puede agregar items (estado incorrecto, SKU duplicado)
- `INFRA_ERROR`: Error de BD, pricing service, o event bus

**Signature:**
```typescript
execute(dto: AddItemToOrderDTO): Promise<Result<void, AddItemToOrderError>>
```

## 🔄 Flujo Completo - CreateOrder

```
HTTP Request (POST /orders)
    ↓
Controller extrae DTO
    ↓
CreateOrderUseCase.execute(dto)
    ├─ Validar inputs
    ├─ Crear Currency VO
    ├─ Verificar no existe (OrderRepository.findById)
    ├─ Crear Order aggregate (dominio)
    ├─ Persistir (OrderRepository.save)
    ├─ Publicar eventos (EventBus.publish)
    └─ Retorna Result<{ orderId }, Error>
    ↓
Controller mapea error o retorna respuesta
    ↓
HTTP Response (201 Created / 400 Bad Request / 409 Conflict / 500 Error)
```

## 🔄 Flujo Completo - AddItemToOrder

```
HTTP Request (POST /orders/{id}/items)
    ↓
Controller extrae DTO
    ↓
AddItemToOrderUseCase.execute(dto)
    ├─ Validar inputs
    ├─ Obtener Order (OrderRepository.findById)
    ├─ Crear SKU VO
    ├─ Crear Quantity VO
    ├─ Obtener precio (PricingService.getPriceForSku)
    ├─ Crear Money VO
    ├─ Agregar item (Order.addItem - con validaciones dominio)
    ├─ Persistir (OrderRepository.update)
    ├─ Publicar eventos (EventBus.publish)
    └─ Retorna Result<void, Error>
    ↓
Controller mapea error o retorna respuesta
    ↓
HTTP Response (204 No Content / 400 Bad Request / 404 Not Found / 409 Conflict / 500 Error)
```

## ✅ Ventajas de esta estructura

1. **Separación de responsabilidades:** Dominio ↔ Aplicación ↔ Infraestructura
2. **Errores explícitos:** Tipos discriminados permiten manejar cada caso
3. **Testeable:** Puertos son interfaces, fácil mock
4. **Agnóstico de tecnología:** Sin dependencias de framework en dominio/aplicación
5. **Reutilizable:** Use cases pueden usarse desde HTTP, CLI, eventos, etc.
6. **Composable:** Result type permite encadenar operaciones

## 🎬 Próximos pasos

1. **Infrastructure Layer:** Implementar repositorios, servicios, event bus
2. **HTTP Adapters:** Controladores que usen los use cases
3. **Tests:** Suite completa para use cases con mocks
4. **Composition Root:** Inyección de dependencias y wiring
