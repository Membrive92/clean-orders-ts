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

    it('cannot add items to confirmed order', () => {
      order.addItem(sku, qty, price);
      order.confirm();
      
      const newSkuRes = SKU.create('PROD-002');
      if (!newSkuRes.success) throw new Error('Failed to create new SKU');
      
      const result = order.addItem(newSkuRes.value, qty, price);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot add items');
      }
    });

    it('cannot add items to finalized order', () => {
      order.addItem(sku, qty, price);
      order.confirm();
      order.finalize();
      
      const newSkuRes = SKU.create('PROD-003');
      if (!newSkuRes.success) throw new Error('Failed to create new SKU');
      
      const result = order.addItem(newSkuRes.value, qty, price);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Cannot add items');
      }
    });

    it('cannot confirm order without items', () => {
      const result = order.confirm();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No se puede confirmar una orden sin items');
      }
    });

    it('cannot finalize order that is not confirmed', () => {
      order.addItem(sku, qty, price);
      const result = order.finalize();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No se puede finalizar una orden en estado DRAFT');
      }
    });

    it('cannot confirm already confirmed order', () => {
      order.addItem(sku, qty, price);
      order.confirm();
      const result = order.confirm();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No se puede confirmar una orden en estado CONFIRMED');
      }
    });

    it('cannot finalize already finalized order', () => {
      order.addItem(sku, qty, price);
      order.confirm();
      order.finalize();
      const result = order.finalize();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('No se puede finalizar una orden en estado FINALIZED');
      }
    });

    it('calculates total with multiple items correctly', () => {
      // Add first item
      order.addItem(sku, qty, price); // 5 * 25.5 = 127.5
      
      // Add second item
      const sku2Res = SKU.create('PROD-002');
      const qty2Res = Quantity.create(3);
      const price2Res = Money.create(15.0, price.currency);
      
      if (!sku2Res.success || !qty2Res.success || !price2Res.success) {
        throw new Error('Failed to create second item components');
      }
      
      order.addItem(sku2Res.value, qty2Res.value, price2Res.value); // 3 * 15.0 = 45.0
      
      const total = order.getTotal();
      expect(total.success).toBe(true);
      if (total.success) {
        expect(total.value.amount).toBe(172.5); // 127.5 + 45.0
      }
    });

    it('handles empty order total', () => {
      const total = order.getTotal();
      expect(total.success).toBe(false);
      if (!total.success) {
        expect(total.error).toContain('No hay items en la orden');
      }
    });

    it('validates order currency consistency', () => {
      // Create different currency
      const eurRes = Currency.create('EUR');
      if (!eurRes.success) throw new Error('Failed to create EUR currency');
      
      const eurPriceRes = Money.create(20.0, eurRes.value);
      if (!eurPriceRes.success) throw new Error('Failed to create EUR price');
      
      // Try to add item with different currency
      const result = order.addItem(sku, qty, eurPriceRes.value);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Moneda del item (EUR) no coincide con la de la orden (USD)');
      }
    });

    it('maintains item order when adding multiple items', () => {
      // Add multiple items
      const items = [
        { sku: 'PROD-001', qty: 2, price: 10.0 },
        { sku: 'PROD-002', qty: 1, price: 15.0 },
        { sku: 'PROD-003', qty: 3, price: 5.0 }
      ];

      items.forEach(item => {
        const skuRes = SKU.create(item.sku);
        const qtyRes = Quantity.create(item.qty);
        const priceRes = Money.create(item.price, price.currency);
        
        if (!skuRes.success || !qtyRes.success || !priceRes.success) {
          throw new Error(`Failed to create components for ${item.sku}`);
        }
        
        const result = order.addItem(skuRes.value, qtyRes.value, priceRes.value);
        expect(result.success).toBe(true);
      });

      expect(order.getItemCount()).toBe(3);
      
      // Verify total calculation
      const total = order.getTotal();
      expect(total.success).toBe(true);
      if (total.success) {
        // (2*10) + (1*15) + (3*5) = 20 + 15 + 15 = 50
        expect(total.value.amount).toBe(50.0);
      }
    });

    it('provides correct item count throughout lifecycle', () => {
      expect(order.getItemCount()).toBe(0);
      
      order.addItem(sku, qty, price);
      expect(order.getItemCount()).toBe(1);
      
      const sku2Res = SKU.create('PROD-002');
      const qty2Res = Quantity.create(2);
      const price2Res = Money.create(30.0, price.currency);
      
      if (!sku2Res.success || !qty2Res.success || !price2Res.success) {
        throw new Error('Failed to create second item');
      }
      
      order.addItem(sku2Res.value, qty2Res.value, price2Res.value);
      expect(order.getItemCount()).toBe(2);
      
      // Item count should remain after status changes
      order.confirm();
      expect(order.getItemCount()).toBe(2);
      
      order.finalize();
      expect(order.getItemCount()).toBe(2);
    });
  });
});
