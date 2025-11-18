# Running Integration Tests

This document explains how to run integration tests that require PostgreSQL.

## Quick Start

### 1. Start Docker Desktop

Ensure Docker Desktop is running on your system.

### 2. Start PostgreSQL Database

```bash
npm run db:up
```

This will start a PostgreSQL 16 container in the background.

### 3. Run Database Migrations

```bash
npm run db:migrate
```

This creates the necessary tables (orders, order_items, outbox).

### 4. Enable Integration Tests

Set `USE_INMEMORY=false` in your `.env` file:

```env
USE_INMEMORY=false
```

### 5. Run All Tests

```bash
npm test
```

Or run only integration tests:

```bash
npm run test:integration
```

## Test Organization

### Unit/Acceptance Tests
- **Location**: `test/domain/`, `test/acceptance/`
- **Database**: Not required
- **Run with**: `npm test` (always run)

### Integration Tests
- **Location**: `test/integration/postgres/`
- **Database**: Required (PostgreSQL)
- **Skip when**: `USE_INMEMORY=true`
- **Run with**: `npm run test:integration`

## Integration Test Suites

### PostgresOrderRepository.spec.ts (7 tests)
- Save and retrieve orders
- Update with UPSERT pattern
- Order status transitions
- Pagination
- DELETE+INSERT pattern for items

### PgUnitOfWork.ts (6 tests)
- Transaction commit on success
- Transaction rollback on business failure
- Transaction rollback on exceptions
- Multiple operations in single transaction
- Transaction isolation
- Repository methods within transaction

## Troubleshooting

### Tests Fail with "Database not available"

**Cause**: Docker is not running or PostgreSQL container is not started.

**Solution**:
1. Start Docker Desktop
2. Run `npm run db:up`
3. Wait for health check: `docker compose ps`
4. Run `npm run db:migrate`

### Tests Fail with "Authentication failed"

**Cause**: Database credentials mismatch.

**Solution**: Ensure `.env` matches `docker-compose.yml`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clean_orders
```

### Tests Are Skipped

**Cause**: `USE_INMEMORY=true` in `.env`

**Solution**: Set `USE_INMEMORY=false`

### Port 5432 Already in Use

**Cause**: Another PostgreSQL instance is running.

**Solution**:
1. Stop other PostgreSQL: `docker compose down` or stop system PostgreSQL
2. Or change port in `docker-compose.yml` and `.env`

## CI/CD Considerations

### GitHub Actions Example

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: clean_orders
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run db:migrate
      - run: npm test
```

## Database Management

### Start Database
```bash
npm run db:up
```

### Stop Database
```bash
npm run db:down
```

### View Database Logs
```bash
docker compose logs -f postgres
```

### Connect to Database (psql)
```bash
docker compose exec postgres psql -U postgres -d clean_orders
```

### Reset Database
```bash
npm run db:down
npm run db:up
npm run db:migrate
```

## Test Database Cleanup

Each test suite uses `beforeEach` to clean up:
```typescript
beforeEach(async () => {
  await pool.query('DELETE FROM order_items');
  await pool.query('DELETE FROM orders');
});
```

This ensures test isolation and idempotency.

## Performance Tips

1. **Keep database running**: Don't stop/start between test runs
2. **Use transactions**: Tests run faster in transactions
3. **Connection pooling**: Configured for 20 concurrent connections
4. **Parallel tests**: Vitest runs tests in parallel by default

## Manual Testing

To manually verify database operations:

```bash
# Start database
npm run db:up

# Run migrations
npm run db:migrate

# Connect to database
docker compose exec postgres psql -U postgres -d clean_orders

# Query tables
SELECT * FROM orders;
SELECT * FROM order_items;
SELECT * FROM outbox;
```
