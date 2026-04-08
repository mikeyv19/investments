-- Migration: Add watchlist sharing support
-- Allows users to share watchlists with other users by email

-- ===========================================
-- 1. Create watchlist_shares table
-- ===========================================
CREATE TABLE watchlist_shares (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    watchlist_id UUID NOT NULL REFERENCES user_watchlists(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(watchlist_id, shared_with_user_id)
);

CREATE INDEX idx_watchlist_shares_watchlist_id ON watchlist_shares(watchlist_id);
CREATE INDEX idx_watchlist_shares_shared_with ON watchlist_shares(shared_with_user_id);

-- ===========================================
-- 2. Helper function: look up user ID by email
-- ===========================================
CREATE OR REPLACE FUNCTION find_user_id_by_email(p_email TEXT)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = LOWER(p_email);
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================
-- 3. Enable RLS on watchlist_shares
-- ===========================================
ALTER TABLE watchlist_shares ENABLE ROW LEVEL SECURITY;

-- SELECT: watchlist owner or the shared-with user
CREATE POLICY "Users can view shares for their watchlists"
    ON watchlist_shares FOR SELECT
    USING (
        auth.uid() = shared_with_user_id
        OR EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_shares.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

-- INSERT: only the watchlist owner can create shares
CREATE POLICY "Watchlist owners can share their watchlists"
    ON watchlist_shares FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_shares.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

-- DELETE: only the watchlist owner can revoke shares
CREATE POLICY "Watchlist owners can revoke shares"
    ON watchlist_shares FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_shares.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
    );

-- ===========================================
-- 4. Update RLS policies on user_watchlists
-- ===========================================

-- SELECT: owner OR shared-with
DROP POLICY IF EXISTS "Users can view their own watchlists" ON user_watchlists;
CREATE POLICY "Users can view accessible watchlists"
    ON user_watchlists FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM watchlist_shares
            WHERE watchlist_shares.watchlist_id = user_watchlists.id
            AND watchlist_shares.shared_with_user_id = auth.uid()
        )
    );

-- INSERT: owner only (unchanged)
DROP POLICY IF EXISTS "Users can create their own watchlists" ON user_watchlists;
CREATE POLICY "Users can create their own watchlists"
    ON user_watchlists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner OR shared-with
DROP POLICY IF EXISTS "Users can update their own watchlists" ON user_watchlists;
CREATE POLICY "Users can update accessible watchlists"
    ON user_watchlists FOR UPDATE
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM watchlist_shares
            WHERE watchlist_shares.watchlist_id = user_watchlists.id
            AND watchlist_shares.shared_with_user_id = auth.uid()
        )
    );

-- DELETE: owner only (unchanged)
DROP POLICY IF EXISTS "Users can delete their own watchlists" ON user_watchlists;
CREATE POLICY "Users can delete their own watchlists"
    ON user_watchlists FOR DELETE
    USING (auth.uid() = user_id);

-- ===========================================
-- 5. Update RLS policies on watchlist_stocks
-- ===========================================

-- SELECT: owner OR shared-with
DROP POLICY IF EXISTS "Users can view stocks in their watchlists" ON watchlist_stocks;
CREATE POLICY "Users can view stocks in accessible watchlists"
    ON watchlist_stocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM watchlist_shares
            WHERE watchlist_shares.watchlist_id = watchlist_stocks.watchlist_id
            AND watchlist_shares.shared_with_user_id = auth.uid()
        )
    );

-- INSERT: owner OR shared-with
DROP POLICY IF EXISTS "Users can add stocks to their watchlists" ON watchlist_stocks;
CREATE POLICY "Users can add stocks to accessible watchlists"
    ON watchlist_stocks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM watchlist_shares
            WHERE watchlist_shares.watchlist_id = watchlist_stocks.watchlist_id
            AND watchlist_shares.shared_with_user_id = auth.uid()
        )
    );

-- DELETE: owner OR shared-with
DROP POLICY IF EXISTS "Users can remove stocks from their watchlists" ON watchlist_stocks;
CREATE POLICY "Users can remove stocks from accessible watchlists"
    ON watchlist_stocks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_watchlists
            WHERE user_watchlists.id = watchlist_stocks.watchlist_id
            AND user_watchlists.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM watchlist_shares
            WHERE watchlist_shares.watchlist_id = watchlist_stocks.watchlist_id
            AND watchlist_shares.shared_with_user_id = auth.uid()
        )
    );
