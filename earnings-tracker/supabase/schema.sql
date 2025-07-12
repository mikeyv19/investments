-- Earnings Tracker Database Schema
-- Based on Project Plan specifications

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE companies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    ticker TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Index for faster ticker lookups
CREATE INDEX idx_companies_ticker ON companies(ticker);

-- User watchlists table
CREATE TABLE user_watchlists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    -- Ensure unique watchlist names per user
    UNIQUE(user_id, name)
);

-- Index for user queries
CREATE INDEX idx_user_watchlists_user_id ON user_watchlists(user_id);

-- Watchlist stocks (junction table)
CREATE TABLE watchlist_stocks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    watchlist_id UUID NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    -- Prevent duplicate stocks in same watchlist
    UNIQUE(watchlist_id, company_id)
);

-- Indexes for junction table queries
CREATE INDEX idx_watchlist_stocks_watchlist_id ON watchlist_stocks(watchlist_id);
CREATE INDEX idx_watchlist_stocks_company_id ON watchlist_stocks(company_id);

-- Historical EPS data from SEC
CREATE TABLE historical_eps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_period TEXT NOT NULL, -- e.g., "Q1 2024"
    eps_actual DECIMAL(10, 4),
    filing_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    -- Prevent duplicate entries for same company/period
    UNIQUE(company_id, fiscal_period)
);

-- Indexes for historical data queries
CREATE INDEX idx_historical_eps_company_id ON historical_eps(company_id);
CREATE INDEX idx_historical_eps_filing_date ON historical_eps(filing_date);

-- Earnings estimates from investor.com
CREATE TABLE earnings_estimates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    earnings_date DATE NOT NULL,
    market_timing TEXT CHECK (market_timing IN ('before', 'after')),
    eps_estimate DECIMAL(10, 4),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    -- Prevent duplicate estimates for same company/date
    UNIQUE(company_id, earnings_date)
);

-- Indexes for earnings estimates queries
CREATE INDEX idx_earnings_estimates_company_id ON earnings_estimates(company_id);
CREATE INDEX idx_earnings_estimates_earnings_date ON earnings_estimates(earnings_date);
CREATE INDEX idx_earnings_estimates_last_updated ON earnings_estimates(last_updated);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE user_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_eps ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings_estimates ENABLE ROW LEVEL SECURITY;

-- Companies: Everyone can read
CREATE POLICY "Companies are viewable by everyone"
    ON companies FOR SELECT
    USING (true);

-- User watchlists: Users can only see/modify their own
CREATE POLICY "Users can view their own watchlists"
    ON user_watchlists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own watchlists"
    ON user_watchlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlists"
    ON user_watchlists FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlists"
    ON user_watchlists FOR DELETE
    USING (auth.uid() = user_id);

-- Watchlist stocks: Users can only see/modify stocks in their watchlists
CREATE POLICY "Users can view stocks in their watchlists"
    ON watchlist_stocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can add stocks to their watchlists"
    ON watchlist_stocks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can remove stocks from their watchlists"
    ON watchlist_stocks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

-- Historical EPS: Everyone can read
CREATE POLICY "Historical EPS data is viewable by everyone"
    ON historical_eps FOR SELECT
    USING (true);

-- Earnings estimates: Everyone can read
CREATE POLICY "Earnings estimates are viewable by everyone"
    ON earnings_estimates FOR SELECT
    USING (true);

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updating updated_at on user_watchlists
CREATE TRIGGER update_user_watchlists_updated_at BEFORE UPDATE
    ON user_watchlists FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get earnings data with company info
CREATE OR REPLACE FUNCTION get_earnings_grid_data(
    p_user_id UUID DEFAULT NULL,
    p_watchlist_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    ticker TEXT,
    company_name TEXT,
    earnings_date DATE,
    market_timing TEXT,
    eps_estimate DECIMAL,
    eps_actual DECIMAL,
    fiscal_period TEXT,
    last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.ticker,
        c.company_name,
        ee.earnings_date,
        ee.market_timing,
        ee.eps_estimate,
        he.eps_actual,
        he.fiscal_period,
        ee.last_updated
    FROM companies c
    LEFT JOIN earnings_estimates ee ON c.id = ee.company_id
    LEFT JOIN historical_eps he ON c.id = he.company_id
        AND he.filing_date = (
            SELECT MAX(filing_date)
            FROM historical_eps
            WHERE company_id = c.id
            AND filing_date <= COALESCE(ee.earnings_date, CURRENT_DATE)
        )
    WHERE 
        -- Filter by watchlist if provided
        (p_watchlist_id IS NULL OR EXISTS (
            SELECT 1 FROM watchlist_stocks ws
            WHERE ws.company_id = c.id
            AND ws.watchlist_id = p_watchlist_id
        ))
        -- Filter by date range if provided
        AND (p_start_date IS NULL OR ee.earnings_date >= p_start_date)
        AND (p_end_date IS NULL OR ee.earnings_date <= p_end_date)
        -- Only show companies with upcoming earnings
        AND ee.earnings_date IS NOT NULL
    ORDER BY ee.earnings_date, c.ticker;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;