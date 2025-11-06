import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';

export class SKU {
  private constructor(readonly value: string) {}

  static create(value: string): Result<SKU, string> {
    if (!value || value.trim().length === 0) {
      return fail('SKU no puede estar vacío');
    }
    if (value.length > 50) {
      return fail('SKU no puede exceder 50 caracteres');
    }
    return ok(new SKU(value.trim().toUpperCase()));
  }

  equals(other: SKU): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
