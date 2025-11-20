import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';
import { Currency } from '../value-objects/Currency.js';
import { SKU } from '../value-objects/SKU.js';
import { Quantity } from '../value-objects/Quantity.js';
import { Money } from '../value-objects/Money.js';
import { OrderLineItem } from '../value-objects/OrderLineItem.js';
import type { DomainEvent } from '../events/index.js';
import { OrderCreated } from '../events/OrderCreated.js';
import { ItemAdded } from '../events/ItemAdded.js';
import { OrderTotalCalculated } from '../events/OrderTotalCalculated.js';
import { OrderFinalized } from '../events/OrderFinalized.js';

export type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'FINALIZED' | 'CANCELLED';

export class Order {
  private lineItems: OrderLineItem[] = [];
  private domainEvents: DomainEvent[] = [];
  private status: OrderStatus = 'DRAFT';

  private constructor(
    readonly id: string,
    readonly currency: Currency,
    createdAt: Date = new Date()
  ) {
    this.recordEvent(new OrderCreated(id, createdAt));
  }

  // Factory method
  static create(id: string, currency: Currency): Result<Order, string> {
    if (!id || id.trim().length === 0) {
      return fail('ID de orden no puede estar vacío');
    }
    return ok(new Order(id, currency));
  }

  // Add item to order
  addItem(sku: SKU, quantity: Quantity, unitPrice: Money): Result<void, string> {
    // Validate that the order is in an allowed state
    if (this.status !== 'DRAFT') {
      return fail(`Cannot add items to an order in ${this.status} state`);
    }

    // Validar que la moneda coincida
    if (!unitPrice.currency.equals(this.currency)) {
      return fail(
        `Moneda del item (${unitPrice.currency}) no coincide con la de la orden (${this.currency})`
      );
    }

    // Create the item
    const result = OrderLineItem.create(sku, quantity, unitPrice);
    if (!result.success) {
      return fail(result.error);
    }

    const lineItem = result.value;

    // Verificar si el SKU ya existe (solo puede haber uno por orden)
    if (this.lineItems.some((item) => item.sku.equals(sku))) {
      return fail(`El item con SKU ${sku} ya existe en esta orden`);
    }

    this.lineItems.push(lineItem);
    this.recordEvent(
      new ItemAdded(this.id, sku.toString(), quantity.value, unitPrice.amount, new Date())
    );

    return ok(undefined);
  }

  // Obtener total de la orden
  getTotal(): Result<Money, string> {
    if (this.lineItems.length === 0) {
      return fail('No hay items en la orden');
    }

    let total: Money | null = null;

    for (const item of this.lineItems) {
      const lineTotal = item.getLineTotal();
      if (!lineTotal.success) {
        return fail(lineTotal.error);
      }

      if (total === null) {
        total = lineTotal.value;
      } else {
        const addResult: Result<Money, string> = total.add(lineTotal.value);
        if (!addResult.success) {
          return fail(addResult.error);
        }
        total = addResult.value;
      }
    }

    if (total === null) {
      return fail('No se pudo calcular el total');
    }

    this.recordEvent(
      new OrderTotalCalculated(this.id, total.amount, total.currency.toString(), new Date())
    );

    return ok(total);
  }

  // Obtener items
  getItems(): OrderLineItem[] {
    return [...this.lineItems];
  }

  // Obtener cantidad de items
  getItemCount(): number {
    return this.lineItems.length;
  }

  // Confirmar orden (cambiar estado a CONFIRMED)
  confirm(): Result<void, string> {
    if (this.status !== 'DRAFT') {
      return fail(`No se puede confirmar una orden en estado ${this.status}`);
    }

    if (this.lineItems.length === 0) {
      return fail('No se puede confirmar una orden sin items');
    }

    this.status = 'CONFIRMED';
    return ok(undefined);
  }

  // Finalizar orden
  finalize(): Result<void, string> {
    if (this.status !== 'CONFIRMED') {
      return fail(`No se puede finalizar una orden en estado ${this.status}`);
    }

    this.status = 'FINALIZED';
    this.recordEvent(new OrderFinalized(this.id, new Date()));

    return ok(undefined);
  }

  // Cancelar orden
  cancel(): Result<void, string> {
    if (this.status === 'FINALIZED' || this.status === 'CANCELLED') {
      return fail(`No se puede cancelar una orden en estado ${this.status}`);
    }

    this.status = 'CANCELLED';
    return ok(undefined);
  }

  // Obtener estado
  getStatus(): OrderStatus {
    return this.status;
  }

  // Obtener eventos de dominio
  getDomainEvents(): DomainEvent[] {
    return [...this.domainEvents];
  }

  // Limpiar eventos
  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  // Helper privado para registrar eventos
  private recordEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
}
