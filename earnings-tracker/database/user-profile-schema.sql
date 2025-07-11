-- =====================================================
-- USER PROFILES TABLE
-- Extends Supabase Auth with user preferences
-- =====================================================
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    default_watchlist_symbols TEXT[], -- Array of default symbols to show
    notification_preferences JSONB DEFAULT '{"email": false, "push": false}'::jsonb,
    theme_preference VARCHAR(20) DEFAULT 'light', -- 'light', 'dark', 'system'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Update the user_watchlist table to reference auth.users
ALTER TABLE user_watchlist 
    DROP CONSTRAINT IF EXISTS user_watchlist_user_id_fkey,
    ADD CONSTRAINT user_watchlist_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- =====================================================
-- USER SETTINGS TABLE
-- Stores user-specific settings and preferences
-- =====================================================
CREATE TABLE user_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    earnings_calendar_view VARCHAR(20) DEFAULT 'week', -- 'day', 'week', 'month'
    default_time_zone VARCHAR(50) DEFAULT 'America/New_York',
    show_premarket_data BOOLEAN DEFAULT true,
    show_afterhours_data BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- User profiles policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- User settings policies
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Apply updated_at trigger to user_profiles table
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE
    ON user_profiles FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to user_settings table
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE
    ON user_settings FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email)
    VALUES (new.id, new.email);
    
    INSERT INTO public.user_settings (user_id)
    VALUES (new.id);
    
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and settings on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();