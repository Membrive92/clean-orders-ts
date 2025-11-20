import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/infrastructure/http/server.js';
import { buildContainer } from '../../src/composition/container.js';
import { DatabaseFactory } from '../../src/infrastructure/database/DatabaseFactory.js';

export interface TestServer {
  app: FastifyInstance;
  url: string;
  cleanup: () => Promise<void>;
}

/**
 * Start a test server for E2E testing
 * Uses the real application stack with PostgreSQL
 */
export async function startTestServer(): Promise<TestServer> {
  // Build real dependencies (PostgreSQL mode)
  const dependencies = buildContainer();

  // Build real Fastify server
  const app = await buildServer(dependencies);

  // Start listening on random port
  await app.listen({ host: '127.0.0.1', port: 0 });

  const address = app.server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 3000;
  const url = `http://127.0.0.1:${port}`;

  // Cleanup function
  const cleanup = async () => {
    await app.close();
    if (dependencies.cleanup) {
      await dependencies.cleanup();
    }
  };

  return { app, url, cleanup };
}

/**
 * Clear database before each test
 */
export async function clearDatabase(): Promise<void> {
  await DatabaseFactory.clearDatabase();
}

/**
 * HTTP client helper for E2E tests
 */
export class E2EClient {
  constructor(private baseUrl: string) {}

  async get<T>(path: string): Promise<{ status: number; body: T }> {
    const response = await fetch(`${this.baseUrl}${path}`);
    const body = await response.json();
    return { status: response.status, body };
  }

  async post<T>(path: string, data: unknown): Promise<{ status: number; body: T }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    return { status: response.status, body };
  }

  async delete(path: string): Promise<{ status: number }> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    });
    return { status: response.status };
  }
}
