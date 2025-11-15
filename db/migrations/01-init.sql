-- Clean Orders Database Schema
-- Migration: 01-init.sql
-- Description: Initial schema with orders, order_items, and outbox pattern

-- ============================================
-- Table: orders
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY,
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'EUR', 'MXN', 'ARS')),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'FINALIZED', 'CANCELLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for orders
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_currency ON orders(currency);

-- ============================================
-- Table: order_items
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    sku VARCHAR(255) NOT NULL CHECK (sku <> ''),
    quantity INTEGER NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
    unit_price_amount DECIMAL(12,2) NOT NULL CHECK (unit_price_amount > 0),
    unit_price_currency VARCHAR(3) NOT NULL CHECK (unit_price_currency IN ('USD', 'EUR', 'MXN', 'ARS')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) 
        REFERENCES orders(id) ON DELETE CASCADE,
    
    -- Unique constraint: no duplicate SKUs per order
    CONSTRAINT uq_order_items_order_sku UNIQUE(order_id, sku)
);

-- Indexes for order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at DESC);

-- ============================================
-- Table: outbox (Transactional Outbox Pattern)
-- ============================================
CREATE TABLE IF NOT EXISTS outbox (
    id SERIAL PRIMARY KEY,
    aggregate_id VARCHAR(255) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- Constraints
    CONSTRAINT chk_outbox_event_type CHECK (event_type <> ''),
    CONSTRAINT chk_outbox_aggregate_type CHECK (aggregate_type <> '')
);

-- Indexes for outbox
-- Critical index for unpublished events (WHERE clause for partial index)
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished 
    ON outbox(created_at ASC) 
    WHERE published_at IS NULL;

-- Index for published events
CREATE INDEX IF NOT EXISTS idx_outbox_published 
    ON outbox(published_at DESC) 
    WHERE published_at IS NOT NULL;

-- Index for finding events by aggregate
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate 
    ON outbox(aggregate_type, aggregate_id, created_at DESC);

-- Index for event type queries
CREATE INDEX IF NOT EXISTS idx_outbox_event_type 
    ON outbox(event_type, created_at DESC);

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE orders IS 'Main orders table - aggregate root';
COMMENT ON TABLE order_items IS 'Order line items - part of order aggregate';
COMMENT ON TABLE outbox IS 'Transactional outbox for reliable event publishing';

COMMENT ON COLUMN outbox.published_at IS 'NULL = pending, NOT NULL = published';
COMMENT ON INDEX idx_outbox_unpublished IS 'Critical for finding unpublished events';
