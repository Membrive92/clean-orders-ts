import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestServer, clearDatabase, E2EClient, type TestServer } from '../e2e/test-helpers.js';
import { z } from 'zod';

// Define expected API schemas
const CreateOrderResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    orderId: z.string().uuid(),
  }),
});

const AddItemResponseSchema = z.object({
  success: z.boolean(),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

describe('Order API Contract Tests', () => {
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

  describe('GET /health - Response Contract', () => {
    it('should return response matching HealthResponse schema', async () => {
      const { status, body } = await client.get('/health');

      expect(status).toBe(200);

      // Validate response matches contract
      const result = HealthResponseSchema.safeParse(body);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.status).toBe('ok');
      }
    });
  });

  describe('POST /orders - Response Contract', () => {
    it('should return response matching CreateOrderResponse schema', async () => {
      const orderId = crypto.randomUUID();
      const payload = {
        orderId,
        currency: 'USD',
      };

      const { status, body } = await client.post('/orders', payload);

      expect(status).toBe(201);

      // Validate response matches contract
      const result = CreateOrderResponseSchema.safeParse(body);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.data.orderId).toBe(orderId);
      }
    });

    it('should return error response matching ErrorResponse schema on invalid input', async () => {
      const payload = {
        orderId: crypto.randomUUID(),
        currency: 'INVALID',
      };

      const { status, body } = await client.post('/orders', payload);

      expect(status).toBe(400);

      // Validate error response matches contract
      const result = ErrorResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });
  });

  describe('POST /orders/:id/items - Response Contract', () => {
    it('should return success response matching schema on valid item', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Add item
      const { status, body } = await client.post(`/orders/${orderId}/items`, {
        sku: 'SKU-001',
        quantity: 1,
      });

      expect(status).toBe(200);

      // Validate response matches contract
      const result = AddItemResponseSchema.safeParse(body);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.data.success).toBe(true);
      }
    });

    it('should return error response matching ErrorResponse schema on invalid input', async () => {
      // Create order
      const orderId = crypto.randomUUID();
      await client.post('/orders', {
        orderId,
        currency: 'USD',
      });

      // Try to add invalid item (missing SKU)
      const { status, body } = await client.post(`/orders/${orderId}/items`, {
        quantity: 1,
      });

      expect(status).toBe(400);

      // Validate error response matches contract
      const result = ErrorResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });

    it('should return error response when order does not exist', async () => {
      const nonExistentId = crypto.randomUUID();

      const { status, body } = await client.post(`/orders/${nonExistentId}/items`, {
        sku: 'SKU-001',
        quantity: 1,
      });

      expect(status).toBe(404);

      // Validate error response matches contract
      const result = ErrorResponseSchema.safeParse(body);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema Validation Edge Cases', () => {
    it('should reject CreateOrderResponse with missing fields', () => {
      const invalidResponse = {
        success: true,
        // Missing data field
      };

      const result = CreateOrderResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject CreateOrderResponse with invalid UUID', () => {
      const invalidResponse = {
        success: true,
        data: {
          orderId: 'not-a-uuid',
        },
      };

      const result = CreateOrderResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should reject ErrorResponse without error field', () => {
      const invalidResponse = {
        message: 'Some error',
        // Missing error field
      };

      const result = ErrorResponseSchema.safeParse(invalidResponse);
      expect(result.success).toBe(false);
    });

    it('should accept ErrorResponse with optional message', () => {
      const validResponse = {
        error: 'VALIDATION_ERROR',
        message: 'Invalid input',
      };

      const result = ErrorResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('should accept ErrorResponse without optional message', () => {
      const validResponse = {
        error: 'ORDER_NOT_FOUND',
      };

      const result = ErrorResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });
  });
});
