-- Initialize Clean Orders Database
-- This script runs automatically when the PostgreSQL container starts

-- Create database if it doesn't exist (handled by POSTGRES_DB env var)

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY,
    currency VARCHAR(3) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sku VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_amount DECIMAL(12,2) NOT NULL CHECK (unit_price_amount > 0),
    unit_price_currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id, sku)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);

-- Insert sample data for development
INSERT INTO orders (id, currency, status) VALUES 
    ('ORDER-001', 'USD', 'DRAFT'),
    ('ORDER-002', 'EUR', 'CONFIRMED'),
    ('ORDER-003', 'USD', 'FINALIZED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (order_id, sku, quantity, unit_price_amount, unit_price_currency) VALUES 
    ('ORDER-001', 'LAPTOP-001', 1, 999.99, 'USD'),
    ('ORDER-001', 'MOUSE-001', 2, 29.99, 'USD'),
    ('ORDER-002', 'PHONE-001', 1, 799.00, 'EUR'),
    ('ORDER-003', 'BOOK-001', 3, 19.99, 'USD')
ON CONFLICT (order_id, sku) DO NOTHING;

-- Grant permissions (optional, depends on your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;