-- =============================================================================
-- WAPPER — COMPLETE SUPABASE POSTGRESQL DATABASE SCHEMA (schema.sql)
-- 100% Free-Tier Real-Time Architecture: Google OAuth Profiles, Friends System,
-- Custom Profile Themes/Banners, Servers, Roles, Channels, Messages & Emojis
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. PROFILES TABLE (Extends Supabase Google Auth `auth.users`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(32) NOT NULL CHECK (char_length(trim(username)) >= 2),
  discriminator VARCHAR(4) NOT NULL DEFAULT '0001' CHECK (discriminator ~ '^[0-9]{4}$'),
  unique_tag VARCHAR(40) GENERATED ALWAYS AS (username || '#' || discriminator) STORED,
  email VARCHAR(255) UNIQUE,
  avatar_url TEXT NOT NULL DEFAULT '',
  banner_url TEXT NOT NULL DEFAULT '',
  banner_color VARCHAR(9) NOT NULL DEFAULT '#5865F2' CHECK (banner_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 300),
  custom_status_text VARCHAR(128) NOT NULL DEFAULT '',
  custom_status_emoji VARCHAR(32) NOT NULL DEFAULT '',
  profile_theme_color VARCHAR(9) NOT NULL DEFAULT '#5865F2' CHECK (profile_theme_color ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$'),
  status VARCHAR(16) NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_profiles_username_discriminator UNIQUE (username, discriminator)
);

CREATE INDEX IF NOT EXISTS idx_profiles_unique_tag ON public.profiles(unique_tag);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);

-- Trigger to automatically provision a profile when a user logs in via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_google_oauth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  raw_name TEXT;
  clean_name VARCHAR(32);
  rand_disc VARCHAR(4);
BEGIN
  raw_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1),
    'WapperUser'
  );
  clean_name := LEFT(REGEXP_REPLACE(TRIM(raw_name), '[^a-zA-Z0-9_ -]', '', 'g'), 32);
  IF char_length(clean_name) < 2 THEN
    clean_name := 'WapperUser';
  END IF;
  rand_disc := LPAD((FLOOR(RANDOM() * 8999) + 1000)::TEXT, 4, '0');

  INSERT INTO public.profiles (
    id,
    username,
    discriminator,
    email,
    avatar_url,
    banner_color,
    profile_theme_color,
    status
  )
  VALUES (
    NEW.id,
    clean_name,
    rand_disc,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    '#5865F2',
    '#5865F2',
    'online'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    avatar_url = CASE
      WHEN public.profiles.avatar_url = '' THEN EXCLUDED.avatar_url
      ELSE public.profiles.avatar_url
    END,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_google_oauth_user();

-- -----------------------------------------------------------------------------
-- 2. FRIENDS TABLE (Social Relationship State Machine)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status VARCHAR(24) NOT NULL CHECK (
    status IN ('pending_incoming', 'pending_outgoing', 'accepted', 'blocked')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friends_pair UNIQUE (user_id, friend_id),
  CONSTRAINT chk_no_self_friend CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_status ON public.friends(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend_status ON public.friends(friend_id, status);

-- -----------------------------------------------------------------------------
-- 3. SERVERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(80) NOT NULL CHECK (char_length(trim(name)) >= 2),
  description VARCHAR(300) NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  invite_code VARCHAR(32) NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON public.servers(owner_id);

-- -----------------------------------------------------------------------------
-- 4. ROLES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(48) NOT NULL,
  color VARCHAR(9) NOT NULL DEFAULT '#818CF8',
  permissions BIGINT NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_server_role_name UNIQUE (server_id, name)
);

-- -----------------------------------------------------------------------------
-- 5. SERVER MEMBERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.server_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  nickname VARCHAR(32),
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  is_deafened BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_server_member UNIQUE (server_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_server_members_server ON public.server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON public.server_members(user_id);

-- -----------------------------------------------------------------------------
-- 6. CHANNELS TABLE (type: 'text' | 'voice')
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL CHECK (char_length(trim(name)) >= 2),
  type VARCHAR(16) NOT NULL CHECK (type IN ('text', 'voice')),
  category VARCHAR(48) NOT NULL DEFAULT 'Text Channels',
  topic VARCHAR(250) NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_server_channel_name UNIQUE (server_id, name, type)
);

CREATE INDEX IF NOT EXISTS idx_channels_server_id ON public.channels(server_id);

-- -----------------------------------------------------------------------------
-- 7. MESSAGES TABLE (Real-Time Channel & Direct Messages)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id VARCHAR(128) NOT NULL,
  server_id VARCHAR(128) NOT NULL,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '' CHECK (char_length(content) <= 4000),
  gif_url TEXT,
  attachment_url TEXT,
  attachment_analysis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON public.messages(channel_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_author ON public.messages(author_id);

-- -----------------------------------------------------------------------------
-- 8. CUSTOM EMOJIS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_emojis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(32) NOT NULL CHECK (name ~ '^[a-zA-Z0-9_]{2,32}$'),
  image_url TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_server_emoji_name UNIQUE (server_id, name)
);

CREATE INDEX IF NOT EXISTS idx_custom_emojis_server ON public.custom_emojis(server_id);

-- -----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_emojis ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view profiles to search friends & view cards; owners can update own profile
CREATE POLICY "Authenticated users can read public profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Friends: Users can read and mutate relationship rows where they are user_id or friend_id
CREATE POLICY "Users can read own friend relationships"
  ON public.friends FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend relationships"
  ON public.friends FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can update own or reciprocal friend relationships"
  ON public.friends FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can delete own or reciprocal friend relationships"
  ON public.friends FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);
