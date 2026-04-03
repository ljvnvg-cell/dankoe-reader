import { supabase, type Highlight } from "./supabase";

const USER_ID_KEY = "dankoe_reader_user_id";

export function getUserId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

export async function addHighlight(params: {
  articleId: string;
  textEn: string | null;
  textZh: string | null;
  paragraphIndex: number | null;
}): Promise<Highlight | null> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("highlights")
    .insert({
      user_id: userId,
      article_id: params.articleId,
      text_en: params.textEn,
      text_zh: params.textZh,
      paragraph_index: params.paragraphIndex,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to add highlight:", error);
    return null;
  }
  return data;
}

export async function getHighlightsForArticle(
  articleId: string
): Promise<Highlight[]> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("user_id", userId)
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to get highlights:", error);
    return [];
  }
  return data || [];
}

export async function getAllHighlights(): Promise<
  (Highlight & { article?: { title_en: string; title_zh: string | null; slug: string } })[]
> {
  const userId = getUserId();
  const { data, error } = await supabase
    .from("highlights")
    .select("*, article:articles(title_en, title_zh, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get all highlights:", error);
    return [];
  }
  return data || [];
}

export async function deleteHighlight(id: string): Promise<boolean> {
  const { error } = await supabase.from("highlights").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete highlight:", error);
    return false;
  }
  return true;
}
