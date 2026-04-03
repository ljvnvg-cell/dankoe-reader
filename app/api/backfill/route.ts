import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, original_url, content_en, published_at, word_count");

  if (!articles) return NextResponse.json({ error: "No articles" });

  let updated = 0;
  for (const article of articles) {
    const updates: Record<string, unknown> = {};

    // Fix missing published_at by scraping the page
    if (!article.published_at) {
      try {
        const res = await fetch(article.original_url, {
          signal: AbortSignal.timeout(10000),
          cache: "no-store",
        });
        if (res.ok) {
          const html = await res.text();
          const jsonLdDate = html.match(/"datePublished":"([^"]+)"/);
          if (jsonLdDate) {
            updates.published_at = new Date(jsonLdDate[1]).toISOString();
          }
        }
      } catch {
        // skip
      }
    }

    // Fix missing word_count
    if (!article.word_count && article.content_en) {
      const plainText = article.content_en.replace(/<[^>]+>/g, " ").trim();
      const wc = plainText.split(/\s+/).filter(Boolean).length;
      updates.word_count = wc;
      updates.popularity = wc;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("articles").update(updates).eq("id", article.id);
      updated++;
    }
  }

  return NextResponse.json({ total: articles.length, updated });
}

export const maxDuration = 300;
