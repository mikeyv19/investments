-- Fix: infinite recursion between user_watchlists and watchlist_shares RLS policies.
--
-- The 20260408 sharing migration made user_watchlists.SELECT reference
-- watchlist_shares, and watchlist_shares.SELECT reference user_watchlists.
-- Each EXISTS subquery re-triggers the other table's RLS, producing
-- Postgres error 42P17 ("infinite recursion detected in policy").
--
-- Fix: wrap the cross-table checks in SECURITY DEFINER functions so the
-- inner lookup runs with owner privileges and skips RLS, breaking the cycle.

CREATE OR REPLACE FUNCTION is_watchlist_owner(p_watchlist_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_watchlists
        WHERE id = p_watchlist_id
          AND user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_watchlist_shared_with_me(p_watchlist_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM watchlist_shares
        WHERE watchlist_id = p_watchlist_id
          AND shared_with_user_id = auth.uid()
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===========================================
-- user_watchlists policies
-- ===========================================

DROP POLICY IF EXISTS "Users can view accessible watchlists" ON user_watchlists;
CREATE POLICY "Users can view accessible watchlists"
    ON user_watchlists FOR SELECT
    USING (
        auth.uid() = user_id
        OR is_watchlist_shared_with_me(id)
    );

DROP POLICY IF EXISTS "Users can update accessible watchlists" ON user_watchlists;
CREATE POLICY "Users can update accessible watchlists"
    ON user_watchlists FOR UPDATE
    USING (
        auth.uid() = user_id
        OR is_watchlist_shared_with_me(id)
    );

-- ===========================================
-- watchlist_shares policies
-- ===========================================

DROP POLICY IF EXISTS "Users can view shares for their watchlists" ON watchlist_shares;
CREATE POLICY "Users can view shares for their watchlists"
    ON watchlist_shares FOR SELECT
    USING (
        auth.uid() = shared_with_user_id
        OR is_watchlist_owner(watchlist_id)
    );

DROP POLICY IF EXISTS "Watchlist owners can share their watchlists" ON watchlist_shares;
CREATE POLICY "Watchlist owners can share their watchlists"
    ON watchlist_shares FOR INSERT
    WITH CHECK (is_watchlist_owner(watchlist_id));

DROP POLICY IF EXISTS "Watchlist owners can revoke shares" ON watchlist_shares;
CREATE POLICY "Watchlist owners can revoke shares"
    ON watchlist_shares FOR DELETE
    USING (is_watchlist_owner(watchlist_id));

-- ===========================================
-- watchlist_stocks policies
-- ===========================================

DROP POLICY IF EXISTS "Users can view stocks in accessible watchlists" ON watchlist_stocks;
CREATE POLICY "Users can view stocks in accessible watchlists"
    ON watchlist_stocks FOR SELECT
    USING (
        is_watchlist_owner(watchlist_id)
        OR is_watchlist_shared_with_me(watchlist_id)
    );

DROP POLICY IF EXISTS "Users can add stocks to accessible watchlists" ON watchlist_stocks;
CREATE POLICY "Users can add stocks to accessible watchlists"
    ON watchlist_stocks FOR INSERT
    WITH CHECK (
        is_watchlist_owner(watchlist_id)
        OR is_watchlist_shared_with_me(watchlist_id)
    );

DROP POLICY IF EXISTS "Users can remove stocks from accessible watchlists" ON watchlist_stocks;
CREATE POLICY "Users can remove stocks from accessible watchlists"
    ON watchlist_stocks FOR DELETE
    USING (
        is_watchlist_owner(watchlist_id)
        OR is_watchlist_shared_with_me(watchlist_id)
    );
