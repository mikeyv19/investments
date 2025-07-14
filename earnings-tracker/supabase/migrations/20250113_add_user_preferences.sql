-- Create user preferences table
CREATE TABLE user_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    -- Ensure unique preferences per user
    UNIQUE(user_id, preference_key)
);

-- Index for user queries
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/modify their own preferences
CREATE POLICY "Users can view their own preferences"
    ON user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences"
    ON user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
    ON user_preferences FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
    ON user_preferences FOR DELETE
    USING (auth.uid() = user_id);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE
    ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();