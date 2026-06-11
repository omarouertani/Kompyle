CREATE TABLE IF NOT EXISTS cv_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL,
  name       TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'fr',
  template   TEXT NOT NULL DEFAULT 'default',
  cv_data    JSONB NOT NULL,
  is_adaptation BOOLEAN NOT NULL DEFAULT false,
  parent_id  UUID REFERENCES cv_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug, locale)
);

CREATE INDEX idx_cv_profiles_slug ON cv_profiles(slug);
CREATE INDEX idx_cv_profiles_locale ON cv_profiles(locale);
CREATE INDEX idx_cv_profiles_gin ON cv_profiles USING GIN (cv_data);
