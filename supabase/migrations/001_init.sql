-- Articles table
CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title_en text NOT NULL,
  title_zh text,
  content_en text NOT NULL,
  content_zh text,
  summary_en text,
  summary_zh text,
  cover_image text,
  original_url text UNIQUE NOT NULL,
  published_at timestamptz,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Highlights table
CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  text_en text,
  text_zh text,
  paragraph_index int,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_article_id ON highlights(article_id);

-- RLS policies
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

-- Articles: public read
CREATE POLICY "Articles are publicly readable"
  ON articles FOR SELECT
  USING (true);

-- Highlights: users can manage their own
CREATE POLICY "Users can read own highlights"
  ON highlights FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own highlights"
  ON highlights FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can delete own highlights"
  ON highlights FOR DELETE
  USING (true);
