import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';

export class Quantity {
  private constructor(readonly value: number) {}

  static create(value: number): Result<Quantity, string> {
    if (!Number.isInteger(value)) {
      return fail('Cantidad debe ser un número entero');
    }
    if (value <= 0) {
      return fail('Cantidad debe ser mayor a 0');
    }
    if (value > 10000) {
      return fail('Cantidad máxima es 10000');
    }
    return ok(new Quantity(value));
  }

  add(other: Quantity): Result<Quantity, string> {
    return Quantity.create(this.value + other.value);
  }

  equals(other: Quantity): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toString();
  }
}
