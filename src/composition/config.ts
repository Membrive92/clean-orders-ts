import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development').describe('Environment'),
  
  // Server
  PORT: z.string().regex(/^\d+$/).transform(Number).default('3000').describe('Server port'),
  
  // Database
  DATABASE_URL: z.string().url().describe('PostgreSQL connection URL'),
  
  // External Services
  PRICING_BASE_URL: z.string().url().describe('Pricing service base URL'),
  
  // Feature Flags
  USE_INMEMORY: z.string().transform(val => val === 'true').default('false').describe('Use in-memory repositories'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info').describe('Pino log level'),
});

// Infer TypeScript type from schema
export type Config = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns a typed configuration object
 * @throws {Error} If validation fails
 */
function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    throw new Error('Environment validation failed');
  }

  return result.data;
}

// Export the validated configuration
export const config = loadConfig();
