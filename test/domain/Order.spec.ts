import { describe, it, expect, beforeEach } from 'vitest';
import { Currency } from '../../src/domain/value-objects/Currency.js';
import { SKU } from '../../src/domain/value-objects/SKU.js';
import { Quantity } from '../../src/domain/value-objects/Quantity.js';
import { Money } from '../../src/domain/value-objects/Money.js';
import { Order } from '../../src/domain/entities/Order.js';

describe('Domain - Order', () => {
  describe('Currency Value Object', () => {
    it('creates a valid currency', () => {
      const result = Currency.create('USD');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.toString()).toBe('USD');
      }
    });

    it('rejects invalid currency', () => {
      const result = Currency.create('XXX');
      expect(result.success).toBe(false);
    });
  });

  describe('SKU Value Object', () => {
    it('creates a valid SKU', () => {
      const result = SKU.create('PROD-001');
      expect(result.success).toBe(true);
    });

    it('rejects empty SKU', () => {
      const result = SKU.create('');
      expect(result.success).toBe(false);
    });
  });

  describe('Quantity Value Object', () => {
    it('creates a valid quantity', () => {
      const result = Quantity.create(5);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.value).toBe(5);
      }
    });

    it('rejects zero or negative quantity', () => {
      expect(Quantity.create(0).success).toBe(false);
      expect(Quantity.create(-5).success).toBe(false);
    });
  });

  describe('Money Value Object', () => {
    it('creates valid money', () => {
      const currency = Currency.create('USD');
      if (currency.success) {
        const result = Money.create(99.99, currency.value);
        expect(result.success).toBe(true);
      }
    });

    it('rejects negative amount', () => {
      const currency = Currency.create('USD');
      if (currency.success) {
        const result = Money.create(-50, currency.value);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Order Aggregate Root', () => {
    let order: Order;
    let sku: SKU;
    let qty: Quantity;
    let price: Money;

    beforeEach(() => {
      const currencyRes = Currency.create('USD');
      if (!currencyRes.success) throw new Error('Failed to create currency');

      const orderRes = Order.create('ORD-001', currencyRes.value);
      if (!orderRes.success) throw new Error('Failed to create order');

      const skuRes = SKU.create('PROD-001');
      if (!skuRes.success) throw new Error('Failed to create SKU');

      const qtyRes = Quantity.create(5);
      if (!qtyRes.success) throw new Error('Failed to create quantity');

      const priceRes = Money.create(25.5, currencyRes.value);
      if (!priceRes.success) throw new Error('Failed to create price');

      order = orderRes.value;
      sku = skuRes.value;
      qty = qtyRes.value;
      price = priceRes.value;
    });

    it('creates a new order with DRAFT status', () => {
      expect(order.getStatus()).toBe('DRAFT');
      expect(order.getItemCount()).toBe(0);
    });

    it('adds an item to the order', () => {
      const result = order.addItem(sku, qty, price);
      expect(result.success).toBe(true);
      expect(order.getItemCount()).toBe(1);
    });

    it('calculates order total correctly', () => {
      order.addItem(sku, qty, price);
      const total = order.getTotal();
      expect(total.success).toBe(true);
      if (total.success) {
        expect(total.value.amount).toBe(127.5); // 5 * 25.5
      }
    });

    it('confirms order', () => {
      order.addItem(sku, qty, price);
      const result = order.confirm();
      expect(result.success).toBe(true);
      expect(order.getStatus()).toBe('CONFIRMED');
    });

    it('finalizes order', () => {
      order.addItem(sku, qty, price);
      order.confirm();
      const result = order.finalize();
      expect(result.success).toBe(true);
      expect(order.getStatus()).toBe('FINALIZED');
    });

    it('prevents duplicate SKUs', () => {
      order.addItem(sku, qty, price);
      const result = order.addItem(sku, qty, price);
      expect(result.success).toBe(false);
    });
  });
});
