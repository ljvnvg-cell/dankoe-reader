import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side Supabase client with service role key
export function createServerClient() {
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
  );
}

export type Article = {
  id: string;
  slug: string;
  title_en: string;
  title_zh: string | null;
  content_en: string;
  content_zh: string | null;
  summary_en: string | null;
  summary_zh: string | null;
  cover_image: string | null;
  original_url: string;
  published_at: string | null;
  popularity: number;
  word_count: number;
  synced_at: string;
  created_at: string;
};

export type Highlight = {
  id: string;
  user_id: string;
  article_id: string;
  text_en: string | null;
  text_zh: string | null;
  paragraph_index: number | null;
  created_at: string;
};
