# User Profiles Migration

This migration creates the `user_profiles` table and sets up automatic profile creation for new users.

## What it does:

1. **Creates the user_profiles table** with the following columns:
   - `id` (UUID) - References auth.users(id) as primary key
   - `display_name` (TEXT) - Optional display name for the user
   - `theme_preference` (TEXT) - Theme preference: 'light', 'dark', or 'system' (default)
   - `notification_preferences` (JSONB) - JSON object for notification settings
   - `created_at` (TIMESTAMP) - When the profile was created
   - `updated_at` (TIMESTAMP) - When the profile was last updated

2. **Sets up Row Level Security (RLS)**:
   - Users can only view their own profile
   - Users can only create their own profile
   - Users can only update their own profile

3. **Creates automatic triggers**:
   - `update_user_profiles_updated_at` - Automatically updates the updated_at timestamp
   - `on_auth_user_created` - Automatically creates a profile when a new user signs up

4. **Creates profiles for existing users** (if any)

## How to apply:

```bash
# Using Supabase CLI
supabase db push

# Or run the migration directly
supabase migration up
```

## API Usage:

The existing API endpoint at `/api/user/profile` already supports:
- `GET` - Retrieve the user's profile
- `PATCH` - Update profile fields (display_name, theme_preference, notification_preferences)

## Note:

The trigger `on_auth_user_created` ensures that every new user automatically gets a profile created with default values. This prevents the need for manual profile creation after signup.