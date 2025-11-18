# Configuration Module

This module provides type-safe configuration loading with automatic validation using Zod.

## Usage

```typescript
import { config, type Config } from './composition/config.js';

// Access configuration values
console.log(config.DATABASE_URL);  // Type: string
console.log(config.PORT);          // Type: number
console.log(config.NODE_ENV);      // Type: 'development' | 'production' | 'test'
console.log(config.USE_INMEMORY);  // Type: boolean
console.log(config.LOG_LEVEL);     // Type: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
```

## Environment Variables

All environment variables are validated on application startup. If validation fails, the application will throw an error with details about missing or invalid variables.

### Required Variables

- `DATABASE_URL`: PostgreSQL connection URL (must be a valid URL)
- `PRICING_BASE_URL`: External pricing service URL (must be a valid URL)

### Optional Variables (with defaults)

- `NODE_ENV`: Environment mode (default: `development`)
- `PORT`: Server port (default: `3000`)
- `USE_INMEMORY`: Use in-memory repositories for testing (default: `false`)
- `LOG_LEVEL`: Logging level for Pino (default: `info`)

## Example `.env` file

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:password@localhost:5432/orders
PRICING_BASE_URL=https://localhost:4000
USE_INMEMORY=false
LOG_LEVEL=info
```

## Type Safety

The `Config` type is automatically inferred from the Zod schema, ensuring type safety throughout your application:

```typescript
type Config = {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  PRICING_BASE_URL: string;
  USE_INMEMORY: boolean;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}
```

## Validation

The module uses Zod schemas to validate:

- URL formats for database and external service URLs
- Port numbers (must be numeric strings, transformed to numbers)
- Environment enums (development/production/test)
- Boolean flags (strings transformed to booleans)
- Log level enums

If validation fails, a detailed error message will be displayed showing which variables are invalid or missing.
