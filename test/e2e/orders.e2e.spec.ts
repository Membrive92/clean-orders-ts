import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, clearDatabase, E2EClient, type TestServer } from './test-helpers.js';

describe('Orders E2E Tests', () => {
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

  describe('POST /orders', () => {
    it('should create a new order with valid data', async () => {
      const orderId = crypto.randomUUID();
      const payload = {
        orderId,
        currency: 'USD',
      };

      const { status, body } = await client.post<{ success: boolean; data: { orderId: string } }>(
        '/orders',
        payload
      );

      expect(status).toBe(201);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('orderId');
      expect(body.data.orderId).toBe(orderId);
    });

    it('should return 400 when orderId is missing', async () => {
      const payload = {
        currency: 'USD',
      };

      const { status, body } = await client.post('/orders', payload);

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when currency is invalid', async () => {
      const orderId = crypto.randomUUID();
      const payload = {
        orderId,
        currency: 'INVALID',
      };

      const { status, body } = await client.post('/orders', payload);

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });

    it('should return 400 when currency is missing', async () => {
      const orderId = crypto.randomUUID();
      const payload = {
        orderId,
      };

      const { status, body } = await client.post('/orders', payload);

      expect(status).toBe(400);
      expect(body).toHaveProperty('error');
    });
  });

  describe('GET /health', () => {
    it('should return health check status', async () => {
      const { status, body } = await client.get<{ status: string }>('/health');

      expect(status).toBe(200);
      expect(body.status).toBe('ok');
    });
  });

  describe('Order lifecycle', () => {
    it('should create multiple orders successfully', async () => {
      // Create first order
      const orderId1 = crypto.randomUUID();
      const { status: status1, body: body1 } = await client.post<{
        success: boolean;
        data: { orderId: string };
      }>('/orders', {
        orderId: orderId1,
        currency: 'USD',
      });

      expect(status1).toBe(201);
      expect(body1.success).toBe(true);
      expect(body1.data.orderId).toBe(orderId1);

      // Create second order
      const orderId2 = crypto.randomUUID();
      const { status: status2, body: body2 } = await client.post<{
        success: boolean;
        data: { orderId: string };
      }>('/orders', {
        orderId: orderId2,
        currency: 'EUR',
      });

      expect(status2).toBe(201);
      expect(body2.success).toBe(true);
      expect(body2.data.orderId).toBe(orderId2);
    });

    it('should reject duplicate order IDs', async () => {
      const orderId = crypto.randomUUID();

      // Create first order
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Try to create duplicate
      const { status, body } = await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      expect(status).toBe(409); // Conflict
      expect(body).toHaveProperty('error');
    });
  });
});
