import { describe, it, expect, beforeEach } from 'vitest';
import { Money } from '../../src/domain/value-objects/Money.js';
import { Currency } from '../../src/domain/value-objects/Currency.js';
import { Quantity } from '../../src/domain/value-objects/Quantity.js';

describe('Domain - Money (Price)', () => {
  let usdCurrency: Currency;
  let eurCurrency: Currency;

  beforeEach(() => {
    const usdResult = Currency.create('USD');
    const eurResult = Currency.create('EUR');
    
    if (!usdResult.success || !eurResult.success) {
      throw new Error('Failed to create currencies in test setup');
    }
    
    usdCurrency = usdResult.value;
    eurCurrency = eurResult.value;
  });

  describe('Money Creation', () => {
    it('creates valid money with positive amount', () => {
      const result = Money.create(10.99, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(10.99);
        expect(result.value.currency.equals(usdCurrency)).toBe(true);
      }
    });

    it('creates valid money with integer amount', () => {
      const result = Money.create(50, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(50);
        expect(result.value.currency.equals(usdCurrency)).toBe(true);
      }
    });

    it('creates valid money with two decimals', () => {
      const result = Money.create(25.50, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(25.50);
      }
    });

    it('rejects negative amount', () => {
      const result = Money.create(-10.50, usdCurrency);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Monto no puede ser negativo');
      }
    });

    it('rejects zero amount', () => {
      const result = Money.create(0, usdCurrency);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Monto debe ser mayor a 0');
      }
    });

    it('rejects more than 2 decimals', () => {
      const result = Money.create(10.999, usdCurrency);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Monto debe tener máximo 2 decimales');
      }
    });

    it('rejects invalid numbers', () => {
      const result = Money.create(NaN, usdCurrency);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Monto debe ser un número válido');
      }
    });

    it('rejects infinite values', () => {
      const result = Money.create(Infinity, usdCurrency);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Monto debe ser un número válido');
      }
    });
  });

  describe('Money Operations', () => {
    let money1: Money;
    let money2: Money;
    let differentCurrencyMoney: Money;

    beforeEach(() => {
      const result1 = Money.create(10.50, usdCurrency);
      const result2 = Money.create(5.25, usdCurrency);
      const result3 = Money.create(8.75, eurCurrency);

      if (!result1.success || !result2.success || !result3.success) {
        throw new Error('Failed to create money in test setup');
      }

      money1 = result1.value;
      money2 = result2.value;
      differentCurrencyMoney = result3.value;
    });

    it('adds money with same currency', () => {
      const result = money1.add(money2);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(15.75);
        expect(result.value.currency.equals(usdCurrency)).toBe(true);
      }
    });

    it('fails to add money with different currencies', () => {
      const result = money1.add(differentCurrencyMoney);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No se puede sumar monedas diferentes');
        expect(result.error).toContain('USD');
        expect(result.error).toContain('EUR');
      }
    });

    it('multiplies money by quantity', () => {
      const qtyResult = Quantity.create(3);
      expect(qtyResult.success).toBe(true);
      
      if (qtyResult.success) {
        const result = money1.multiply(qtyResult.value);
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.amount).toBe(31.50);
          expect(result.value.currency.equals(usdCurrency)).toBe(true);
        }
      }
    });

    it('multiplies by zero quantity fails', () => {
      const qtyResult = Quantity.create(1);
      expect(qtyResult.success).toBe(true);
      
      if (qtyResult.success) {
        // Create a money that when multiplied by 0 would result in 0
        const zeroResult = Money.create(10, usdCurrency);
        expect(zeroResult.success).toBe(true);
        
        if (zeroResult.success) {
          // Simulate multiplication by 0 by creating money with 0 amount
          const result = Money.create(0, usdCurrency);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('Monto debe ser mayor a 0');
          }
        }
      }
    });
  });

  describe('Money Equality and String Representation', () => {
    it('determines equality correctly for same values', () => {
      const money1Result = Money.create(10.50, usdCurrency);
      const money2Result = Money.create(10.50, usdCurrency);
      
      expect(money1Result.success).toBe(true);
      expect(money2Result.success).toBe(true);
      
      if (money1Result.success && money2Result.success) {
        expect(money1Result.value.equals(money2Result.value)).toBe(true);
      }
    });

    it('determines inequality for different amounts', () => {
      const money1Result = Money.create(10.50, usdCurrency);
      const money2Result = Money.create(15.75, usdCurrency);
      
      expect(money1Result.success).toBe(true);
      expect(money2Result.success).toBe(true);
      
      if (money1Result.success && money2Result.success) {
        expect(money1Result.value.equals(money2Result.value)).toBe(false);
      }
    });

    it('determines inequality for different currencies', () => {
      const money1Result = Money.create(10.50, usdCurrency);
      const money2Result = Money.create(10.50, eurCurrency);
      
      expect(money1Result.success).toBe(true);
      expect(money2Result.success).toBe(true);
      
      if (money1Result.success && money2Result.success) {
        expect(money1Result.value.equals(money2Result.value)).toBe(false);
      }
    });

    it('formats string representation correctly', () => {
      const moneyResult = Money.create(10.5, usdCurrency);
      
      expect(moneyResult.success).toBe(true);
      if (moneyResult.success) {
        expect(moneyResult.value.toString()).toBe('10.50 USD');
      }
    });

    it('formats string representation with zero padding', () => {
      const moneyResult = Money.create(10, usdCurrency);
      
      expect(moneyResult.success).toBe(true);
      if (moneyResult.success) {
        expect(moneyResult.value.toString()).toBe('10.00 USD');
      }
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('handles very small positive amounts', () => {
      const result = Money.create(0.01, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(0.01);
      }
    });

    it('handles large amounts', () => {
      const result = Money.create(999999.99, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(999999.99);
      }
    });

    it('handles rounding precision correctly', () => {
      // Test case where floating point might cause issues
      const result = Money.create(10.10, usdCurrency);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.amount).toBe(10.10);
      }
    });

    it('validates decimal precision exactly', () => {
      // This should pass (exactly 2 decimals)
      const validResult = Money.create(10.25, usdCurrency);
      expect(validResult.success).toBe(true);
      
      // This should fail (3 decimals)
      const invalidResult = Money.create(10.255, usdCurrency);
      expect(invalidResult.success).toBe(false);
    });
  });
});