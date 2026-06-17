CREATE TABLE IF NOT EXISTS cv_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'fr',
  template   TEXT NOT NULL DEFAULT 'default',
  cv_data    JSONB NOT NULL,
  cover_letter JSONB,
  original_cv JSONB,
  is_adaptation BOOLEAN NOT NULL DEFAULT false,
  parent_id  UUID REFERENCES cv_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug, locale)
);

-- Migration idempotente : la lettre de motivation appartient au profil (CV).
ALTER TABLE cv_profiles ADD COLUMN IF NOT EXISTS cover_letter JSONB;
-- Snapshot du CV original au moment de l'adaptation (pour un diff stable).
ALTER TABLE cv_profiles ADD COLUMN IF NOT EXISTS original_cv JSONB;
-- Normalise l'ancien identifiant de template "chaima" → "modern".
UPDATE cv_profiles SET template = 'modern' WHERE template = 'chaima';

CREATE INDEX IF NOT EXISTS idx_cv_profiles_slug ON cv_profiles(slug);
CREATE INDEX IF NOT EXISTS idx_cv_profiles_locale ON cv_profiles(locale);
CREATE INDEX IF NOT EXISTS idx_cv_profiles_gin ON cv_profiles USING GIN (cv_data);
