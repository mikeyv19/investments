-- Earnings Tracker Database Schema
-- This schema is designed to work with Supabase (PostgreSQL)

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- EARNINGS TABLE
-- Stores earnings date information for stocks
-- =====================================================
CREATE TABLE earnings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    earnings_date DATE NOT NULL,
    earnings_time VARCHAR(20), -- 'BMO' (Before Market Open), 'AMC' (After Market Close), 'Unknown'
    fiscal_quarter VARCHAR(10), -- 'Q1', 'Q2', 'Q3', 'Q4'
    fiscal_year INTEGER,
    estimated_eps DECIMAL(10,4), -- Estimated earnings per share
    reported_eps DECIMAL(10,4), -- Actual reported earnings per share (null until reported)
    surprise_percent DECIMAL(10,4), -- Earnings surprise percentage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(symbol, earnings_date)
);

-- =====================================================
-- API CACHE TABLE
-- Caches API responses to minimize external API calls
-- =====================================================
CREATE TABLE api_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cache_key VARCHAR(255) UNIQUE NOT NULL,
    cache_value JSONB NOT NULL,
    api_source VARCHAR(50), -- 'polygon', 'alphavantage'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- USER WATCHLIST TABLE (Future Enhancement)
-- Tracks user's favorite stocks
-- =====================================================
CREATE TABLE user_watchlist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL, -- Will use Supabase Auth
    symbol VARCHAR(10) NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, symbol)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Earnings table indexes
CREATE INDEX idx_earnings_symbol ON earnings(symbol);
CREATE INDEX idx_earnings_date ON earnings(earnings_date);
CREATE INDEX idx_earnings_symbol_date ON earnings(symbol, earnings_date);
-- Simple index for date range queries (without WHERE clause)
CREATE INDEX idx_earnings_date_btree ON earnings(earnings_date);

-- API cache indexes
CREATE INDEX idx_api_cache_key ON api_cache(cache_key);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);
-- Simple index for cleanup queries (without WHERE clause)
CREATE INDEX idx_api_cache_expires_btree ON api_cache(expires_at);

-- Watchlist indexes
CREATE INDEX idx_watchlist_user ON user_watchlist(user_id);
CREATE INDEX idx_watchlist_symbol ON user_watchlist(symbol);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to earnings table
CREATE TRIGGER update_earnings_updated_at BEFORE UPDATE
    ON earnings FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired cache entries (can be called periodically)
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM api_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ language 'plpgsql';

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_watchlist ENABLE ROW LEVEL SECURITY;

-- Earnings table policies
-- Everyone can read earnings data
CREATE POLICY "Public can read earnings" ON earnings
    FOR SELECT USING (true);

-- Only service role can insert/update/delete earnings
CREATE POLICY "Service role can manage earnings" ON earnings
    FOR ALL USING (auth.role() = 'service_role');

-- API cache policies
-- Only service role can access cache
CREATE POLICY "Service role can manage cache" ON api_cache
    FOR ALL USING (auth.role() = 'service_role');

-- Watchlist policies
-- Users can only see their own watchlist
CREATE POLICY "Users can view own watchlist" ON user_watchlist
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only manage their own watchlist
CREATE POLICY "Users can manage own watchlist" ON user_watchlist
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- SAMPLE DATA (Comment out in production)
-- =====================================================

-- Sample earnings data (uncomment to test)
/*
INSERT INTO earnings (symbol, company_name, earnings_date, earnings_time, fiscal_quarter, fiscal_year)
VALUES 
    ('AAPL', 'Apple Inc.', '2024-01-25', 'AMC', 'Q1', 2024),
    ('MSFT', 'Microsoft Corporation', '2024-01-24', 'AMC', 'Q2', 2024),
    ('GOOGL', 'Alphabet Inc.', '2024-01-30', 'AMC', 'Q4', 2023),
    ('AMZN', 'Amazon.com Inc.', '2024-02-01', 'AMC', 'Q4', 2023),
    ('META', 'Meta Platforms Inc.', '2024-02-01', 'AMC', 'Q4', 2023);
*/

-- =====================================================
-- MAINTENANCE QUERIES
-- =====================================================

-- Query to check table sizes
/*
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
*/

-- Query to check cache hit rate
/*
SELECT 
    COUNT(*) FILTER (WHERE expires_at > NOW()) AS active_cache,
    COUNT(*) FILTER (WHERE expires_at <= NOW()) AS expired_cache,
    COUNT(*) AS total_cache
FROM api_cache;
*/