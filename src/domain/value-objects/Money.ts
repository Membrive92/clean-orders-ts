import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';
import { Currency } from './Currency.js';
import { Quantity } from './Quantity.js';

export class Money {
  private constructor(readonly amount: number, readonly currency: Currency) {}

  static create(amount: number, currency: Currency): Result<Money, string> {
    if (!Number.isFinite(amount)) {
      return fail('Monto debe ser un número válido');
    }
    if (amount < 0) {
      return fail('Monto no puede ser negativo');
    }
    if (amount === 0) {
      return fail('Monto debe ser mayor a 0');
    }
    // Máximo 2 decimales
    if (Math.round(amount * 100) / 100 !== amount) {
      return fail('Monto debe tener máximo 2 decimales');
    }
    return ok(new Money(amount, currency));
  }

  add(other: Money): Result<Money, string> {
    if (!this.currency.equals(other.currency)) {
      return fail(`No se puede sumar monedas diferentes: ${this.currency} y ${other.currency}`);
    }
    return Money.create(this.amount + other.amount, this.currency);
  }

  multiply(quantity: Quantity): Result<Money, string> {
    return Money.create(this.amount * quantity.value, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency.equals(other.currency);
  }

  toString(): string {
    return `${this.amount.toFixed(2)} ${this.currency}`;
  }
}
