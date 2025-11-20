import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, clearDatabase, E2EClient, type TestServer } from './test-helpers.js';

describe('Order Items E2E Tests', () => {
  let server: TestServer;
  let client: E2EClient;

  beforeAll(async () => {
    server = await startTestServer();
    client = new E2EClient(server.url);
  });

  afterAll(async () => {
    await server.cleanup();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  describe('POST /orders/:id/items', () => {
    it('should add item to order successfully', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Add item
      const itemPayload = {
        sku: 'SKU-001', // Use a known SKU from StaticPricingService
        quantity: 2,
      };

      const { status, body } = await client.post<{ success: boolean }>(
        `/orders/${orderId}/items`,
        itemPayload
      );

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('should add multiple items to the same order', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Add first item
      const { status: status1 } = await client.post(`/orders/${orderId}/items`, {
        sku: 'SKU-001',
        quantity: 1,
      });

      expect(status1).toBe(200);

      // Add second item
      const { status: status2 } = await client.post(`/orders/${orderId}/items`, {
        sku: 'SKU-002',
        quantity: 2,
      });

      expect(status2).toBe(200);
    });

    it('should return 400 when SKU is empty', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Try to add invalid item
      const { status, body } = await client.post(`/orders/${orderId}/items`, {
        sku: '',
        quantity: 1,
      });

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when quantity is missing', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Try to add invalid item
      const { status, body } = await client.post(`/orders/${orderId}/items`, {
        sku: 'LAPTOP-001',
      });

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when SKU is missing', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Try to add invalid item
      const { status, body } = await client.post(`/orders/${orderId}/items`, {
        quantity: 1,
      });

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('should return 404 when order does not exist', async () => {
      const nonExistentId = crypto.randomUUID();

      const { status, body } = await client.post(`/orders/${nonExistentId}/items`, {
        sku: 'SKU-001',
        quantity: 1,
      });

      expect(status).toBe(404);
      expect(body).toHaveProperty('error');
    });
  });

  describe('Complete Order Flow', () => {
    it('should create order and add multiple items', async () => {
      // Step 1: Create order
      const orderId = crypto.randomUUID();
      const { status: createStatus, body: createBody } = await client.post<{
        success: boolean;
        data: { orderId: string };
      }>('/orders', {
        orderId,
        currency: 'USD',
      });

      expect(createStatus).toBe(201);
      expect(createBody.success).toBe(true);
      expect(createBody.data.orderId).toBe(orderId);

      // Step 2: Add first item
      const { status: item1Status, body: item1Body } = await client.post<{ success: boolean }>(
        `/orders/${orderId}/items`,
        {
          sku: 'SKU-001',
          quantity: 2,
        }
      );

      expect(item1Status).toBe(200);
      expect(item1Body.success).toBe(true);

      // Step 3: Add second item
      const { status: item2Status, body: item2Body } = await client.post<{ success: boolean }>(
        `/orders/${orderId}/items`,
        {
          sku: 'SKU-002',
          quantity: 3,
        }
      );

      expect(item2Status).toBe(200);
      expect(item2Body.success).toBe(true);
    });
  });
});
