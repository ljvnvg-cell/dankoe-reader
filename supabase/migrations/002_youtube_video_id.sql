-- Add youtube_video_id column to articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS youtube_video_id text;
