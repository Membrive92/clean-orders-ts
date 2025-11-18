import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PostgresOrderRepository } from '../../../src/infrastructure/postgres/PostgresOrderRepository.js';
import { Order } from '../../../src/domain/entities/Order.js';
import { Currency } from '../../../src/domain/value-objects/Currency.js';
import { SKU } from '../../../src/domain/value-objects/SKU.js';
import { Quantity } from '../../../src/domain/value-objects/Quantity.js';
import { Money } from '../../../src/domain/value-objects/Money.js';
import { config } from '../../../src/composition/config.js';
import pg from 'pg';

const { Pool } = pg;

describe('PostgresOrderRepository - Integration Tests', () => {
  let repository: PostgresOrderRepository;
  let pool: pg.Pool;

  beforeAll(async () => {
    // Skip tests if USE_INMEMORY is true
    if (config.USE_INMEMORY) {
      console.log('⚠️  Skipping PostgreSQL integration tests (USE_INMEMORY=true)');
      return;
    }

    repository = new PostgresOrderRepository(config.DATABASE_URL);
    pool = new Pool({ connectionString: config.DATABASE_URL });

    // Ensure database is ready
    const healthCheck = await repository.healthCheck();
    if (!healthCheck.success) {
      throw new Error(`Database not available: ${healthCheck.error}`);
    }
  });

  afterAll(async () => {
    if (config.USE_INMEMORY) return;
    
    await repository.close();
    await pool.end();
  });

  beforeEach(async () => {
    if (config.USE_INMEMORY) return;

    // Clean up database before each test
    await pool.query('DELETE FROM order_items');
    await pool.query('DELETE FROM orders');
  });

  it('should save and retrieve an order', async () => {
    if (config.USE_INMEMORY) return;

    // Create order
    const currencyResult = Currency.create('USD');
    expect(currencyResult.success).toBe(true);
    if (!currencyResult.success) return;

    const orderResult = Order.create('order-001', currencyResult.value);
    expect(orderResult.success).toBe(true);
    if (!orderResult.success) return;

    const order = orderResult.value;

    // Add items
    const sku1 = SKU.create('ITEM-001');
    const qty1 = Quantity.create(2);
    const price1 = Money.create(10.50, currencyResult.value);

    expect(sku1.success).toBe(true);
    expect(qty1.success).toBe(true);
    expect(price1.success).toBe(true);

    if (!sku1.success || !qty1.success || !price1.success) return;

    const addResult = order.addItem(sku1.value, qty1.value, price1.value);
    expect(addResult.success).toBe(true);

    // Save order
    const saveResult = await repository.save(order);
    expect(saveResult.success).toBe(true);

    // Retrieve order
    const findResult = await repository.findById('order-001');
    expect(findResult.success).toBe(true);
    if (!findResult.success) return;

    const retrievedOrder = findResult.value;
    expect(retrievedOrder).not.toBeNull();
    expect(retrievedOrder?.id).toBe('order-001');
    expect(retrievedOrder?.currency.toString()).toBe('USD');
    expect(retrievedOrder?.getItems().length).toBe(1);
    expect(retrievedOrder?.getItems()[0].sku.toString()).toBe('ITEM-001');
    expect(retrievedOrder?.getItems()[0].quantity.value).toBe(2);
  });

  it('should update an order using upsert', async () => {
    if (config.USE_INMEMORY) return;

    // Create and save initial order
    const currencyResult = Currency.create('EUR');
    expect(currencyResult.success).toBe(true);
    if (!currencyResult.success) return;

    const orderResult = Order.create('order-002', currencyResult.value);
    expect(orderResult.success).toBe(true);
    if (!orderResult.success) return;

    const order = orderResult.value;

    const sku1 = SKU.create('ITEM-A');
    const qty1 = Quantity.create(1);
    const price1 = Money.create(20.00, currencyResult.value);

    if (!sku1.success || !qty1.success || !price1.success) return;

    order.addItem(sku1.value, qty1.value, price1.value);

    const saveResult = await repository.save(order);
    expect(saveResult.success).toBe(true);

    // Retrieve and add another item
    const findResult = await repository.findById('order-002');
    expect(findResult.success).toBe(true);
    if (!findResult.success || !findResult.value) return;

    const retrievedOrder = findResult.value;

    const sku2 = SKU.create('ITEM-B');
    const qty2 = Quantity.create(3);
    const price2 = Money.create(15.50, currencyResult.value);

    if (!sku2.success || !qty2.success || !price2.success) return;

    retrievedOrder.addItem(sku2.value, qty2.value, price2.value);

    // Update order
    const updateResult = await repository.update(retrievedOrder);
    expect(updateResult.success).toBe(true);

    // Verify update
    const findResult2 = await repository.findById('order-002');
    expect(findResult2.success).toBe(true);
    if (!findResult2.success || !findResult2.value) return;

    const updatedOrder = findResult2.value;
    expect(updatedOrder.getItems().length).toBe(2);
    expect(updatedOrder.getItems()[0].sku.toString()).toBe('ITEM-A');
    expect(updatedOrder.getItems()[1].sku.toString()).toBe('ITEM-B');
  });

  it('should handle order status transitions', async () => {
    if (config.USE_INMEMORY) return;

    // Create order
    const currencyResult = Currency.create('MXN');
    expect(currencyResult.success).toBe(true);
    if (!currencyResult.success) return;

    const orderResult = Order.create('order-003', currencyResult.value);
    expect(orderResult.success).toBe(true);
    if (!orderResult.success) return;

    const order = orderResult.value;

    const sku = SKU.create('ITEM-X');
    const qty = Quantity.create(5);
    const price = Money.create(100.00, currencyResult.value);

    if (!sku.success || !qty.success || !price.success) return;

    order.addItem(sku.value, qty.value, price.value);
    
    // Confirm and save
    const confirmResult = order.confirm();
    expect(confirmResult.success).toBe(true);

    const saveResult = await repository.save(order);
    expect(saveResult.success).toBe(true);

    // Retrieve and verify status
    const findResult = await repository.findById('order-003');
    expect(findResult.success).toBe(true);
    if (!findResult.success || !findResult.value) return;

    const retrievedOrder = findResult.value;
    expect(retrievedOrder.getStatus()).toBe('CONFIRMED');

    // Finalize and update
    const finalizeResult = retrievedOrder.finalize();
    expect(finalizeResult.success).toBe(true);

    const updateResult = await repository.update(retrievedOrder);
    expect(updateResult.success).toBe(true);

    // Verify finalized status
    const findResult2 = await repository.findById('order-003');
    expect(findResult2.success).toBe(true);
    if (!findResult2.success || !findResult2.value) return;

    expect(findResult2.value.getStatus()).toBe('FINALIZED');
  });

  it('should return null for non-existent order', async () => {
    if (config.USE_INMEMORY) return;

    const findResult = await repository.findById('non-existent');
    expect(findResult.success).toBe(true);
    if (!findResult.success) return;
    expect(findResult.value).toBeNull();
  });

  it('should fail to update non-existent order', async () => {
    if (config.USE_INMEMORY) return;

    const currencyResult = Currency.create('USD');
    expect(currencyResult.success).toBe(true);
    if (!currencyResult.success) return;

    const orderResult = Order.create('non-existent-order', currencyResult.value);
    expect(orderResult.success).toBe(true);
    if (!orderResult.success) return;

    const updateResult = await repository.update(orderResult.value);
    expect(updateResult.success).toBe(false);
    if (updateResult.success) return;
    expect(updateResult.error).toContain('not found');
  });

  it('should find all orders with pagination', async () => {
    if (config.USE_INMEMORY) return;

    // Create multiple orders
    const currencyResult = Currency.create('USD');
    if (!currencyResult.success) return;

    for (let i = 1; i <= 5; i++) {
      const orderResult = Order.create(`order-${i}`, currencyResult.value);
      if (!orderResult.success) continue;

      const order = orderResult.value;

      const sku = SKU.create(`ITEM-${i}`);
      const qty = Quantity.create(1);
      const price = Money.create(10.00, currencyResult.value);

      if (!sku.success || !qty.success || !price.success) continue;

      order.addItem(sku.value, qty.value, price.value);
      await repository.save(order);
    }

    // Find all
    const allResult = await repository.findAll();
    expect(allResult.success).toBe(true);
    if (!allResult.success) return;
    expect(allResult.value.length).toBe(5);

    // Find with limit
    const limitResult = await repository.findAll(3);
    expect(limitResult.success).toBe(true);
    if (!limitResult.success) return;
    expect(limitResult.value.length).toBe(3);

    // Find with limit and offset
    const paginatedResult = await repository.findAll(2, 2);
    expect(paginatedResult.success).toBe(true);
    if (!paginatedResult.success) return;
    expect(paginatedResult.value.length).toBe(2);
  });

  it('should handle DELETE+INSERT pattern for items', async () => {
    if (config.USE_INMEMORY) return;

    // Create order with 2 items
    const currencyResult = Currency.create('EUR');
    if (!currencyResult.success) return;

    const orderResult = Order.create('order-delete-insert', currencyResult.value);
    if (!orderResult.success) return;

    const order = orderResult.value;

    // Add 2 items
    const sku1 = SKU.create('ORIGINAL-1');
    const qty1 = Quantity.create(2);
    const price1 = Money.create(50.00, currencyResult.value);

    const sku2 = SKU.create('ORIGINAL-2');
    const qty2 = Quantity.create(1);
    const price2 = Money.create(30.00, currencyResult.value);

    if (!sku1.success || !qty1.success || !price1.success) return;
    if (!sku2.success || !qty2.success || !price2.success) return;

    order.addItem(sku1.value, qty1.value, price1.value);
    order.addItem(sku2.value, qty2.value, price2.value);

    await repository.save(order);

    // Verify 2 items saved
    const rows1 = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE order_id = $1', ['order-delete-insert']);
    expect(parseInt(rows1.rows[0].count)).toBe(2);

    // Retrieve order and create a "new version" with different items
    const findResult = await repository.findById('order-delete-insert');
    if (!findResult.success || !findResult.value) return;

    const retrievedOrder = findResult.value;

    // Since we can't remove items from Order (no removeItem method), 
    // we create a new order with same ID and different items
    const newOrderResult = Order.create('order-delete-insert', currencyResult.value);
    if (!newOrderResult.success) return;

    const newOrder = newOrderResult.value;

    const sku3 = SKU.create('NEW-ITEM-1');
    const qty3 = Quantity.create(5);
    const price3 = Money.create(25.00, currencyResult.value);

    if (!sku3.success || !qty3.success || !price3.success) return;

    newOrder.addItem(sku3.value, qty3.value, price3.value);

    // Update (should DELETE old items and INSERT new one)
    await repository.save(newOrder);

    // Verify only 1 item remains
    const rows2 = await pool.query('SELECT COUNT(*) as count FROM order_items WHERE order_id = $1', ['order-delete-insert']);
    expect(parseInt(rows2.rows[0].count)).toBe(1);

    // Verify it's the new item
    const items = await pool.query('SELECT sku FROM order_items WHERE order_id = $1', ['order-delete-insert']);
    expect(items.rows[0].sku).toBe('NEW-ITEM-1');
  });
});
