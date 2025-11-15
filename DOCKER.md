# Docker Setup for Clean Orders

## 🐳 Quick Start

### Start PostgreSQL
```bash
# Start the database
docker-compose up -d

# Check if it's running
docker-compose ps

# View logs
docker-compose logs postgres
```

### Stop PostgreSQL
```bash
# Stop the database
docker-compose down

# Stop and remove volumes (⚠️ This will delete all data)
docker-compose down -v
```

## 📊 Database Access

### Connection Details
- **Host:** localhost
- **Port:** 5432
- **Database:** clean_orders
- **Username:** postgres
- **Password:** postgres
- **Connection URL:** `postgresql://postgres:postgres@localhost:5432/clean_orders`

### Connect via psql
```bash
# Using Docker
docker-compose exec postgres psql -U postgres -d clean_orders

# Using local psql (if installed)
psql -h localhost -p 5432 -U postgres -d clean_orders
```

### Connect via GUI Tools
Use any PostgreSQL GUI tool with the connection details above:
- pgAdmin
- DBeaver
- DataGrip
- VS Code PostgreSQL extension

## 🗄️ Database Schema

The database is automatically initialized with:
- `orders` table for order data
- `order_items` table for order line items
- Proper indexes for performance
- Sample data for development

## 📁 Files Structure

```
docker-compose.yml     # Docker services definition
.env                  # Environment variables (create your own)
init-db/
  └── 01-init.sql     # Database initialization script
```

## 🔧 Customization

### Environment Variables
Create a `.env` file in the root directory with your database configuration:
```bash
# Example variables you might need:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clean_orders
DB_HOST=localhost
DB_PORT=5432
DB_NAME=clean_orders
DB_USER=postgres
DB_PASSWORD=postgres
```

### Database Initialization
Add additional SQL scripts to `init-db/` directory. They will be executed in alphabetical order.

## 🚨 Health Check

The PostgreSQL container includes a health check that verifies the database is ready to accept connections.

## 💾 Data Persistence

Data is persisted in a Docker volume named `postgres_data`. The data will survive container restarts but will be lost if you run `docker-compose down -v`.