import type { Result } from '../../shared/result.js';
import { ok } from '../../shared/result.js';
import { SKU } from './SKU.js';
import { Quantity } from './Quantity.js';
import { Money } from './Money.js';

export class OrderLineItem {
  private constructor(
    readonly sku: SKU,
    readonly quantity: Quantity,
    readonly unitPrice: Money
  ) {}

  static create(sku: SKU, quantity: Quantity, unitPrice: Money): Result<OrderLineItem, string> {
    return ok(new OrderLineItem(sku, quantity, unitPrice));
  }

  getLineTotal(): Result<Money, string> {
    return this.unitPrice.multiply(this.quantity);
  }

  equals(other: OrderLineItem): boolean {
    return (
      this.sku.equals(other.sku) &&
      this.quantity.equals(other.quantity) &&
      this.unitPrice.equals(other.unitPrice)
    );
  }

  toString(): string {
    return `${this.sku} x${this.quantity} @ ${this.unitPrice}`;
  }
}
