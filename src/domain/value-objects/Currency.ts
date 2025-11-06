import type { Result } from '../../shared/result.js';
import { ok, fail } from '../../shared/result.js';

export class Currency {
  private constructor(readonly code: string) {}

  static create(code: string): Result<Currency, string> {
    const validCurrencies = ['USD', 'EUR', 'MXN', 'ARS'];
    if (!validCurrencies.includes(code.toUpperCase())) {
      return fail(`Moneda inválida: ${code}. Válidas: ${validCurrencies.join(', ')}`);
    }
    return ok(new Currency(code.toUpperCase()));
  }

  equals(other: Currency): boolean {
    return this.code === other.code;
  }

  toString(): string {
    return this.code;
  }
}
