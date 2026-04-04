import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

function fixLazyImages(html: string): string {
  return html.replace(
    /<img([^>]*)src="data:image\/svg\+xml[^"]*"([^>]*)data-lazy-src="([^"]+)"([^>]*)\/?\s*>/gi,
    (_, before, mid, realSrc, after) => {
      const srcsetMatch = `${before}${mid}${after}`.match(/data-lazy-srcset="([^"]+)"/);
      const srcset = srcsetMatch ? ` srcset="${srcsetMatch[1]}"` : "";
      const cleanAttrs = `${before}${mid}${after}`
        .replace(/data-lazy-src="[^"]*"/g, "")
        .replace(/data-lazy-srcset="[^"]*"/g, "")
        .replace(/data-lazy-sizes="[^"]*"/g, "")
        .replace(/\s+/g, " ");
      return `<img src="${realSrc}"${srcset}${cleanAttrs}/>`;
    }
  );
}

function fixTranslatedImgAttrs(html: string): string {
  // Fix translated img attributes like 解码="async" back to decoding="async"
  return html
    .replace(/解码="([^"]+)"/g, 'decoding="$1"')
    .replace(/宽度="([^"]+)"/g, 'width="$1"')
    .replace(/高度="([^"]+)"/g, 'height="$1"')
    .replace(/加载="([^"]+)"/g, 'loading="$1"')
    .replace(/获取优先级="([^"]+)"/g, 'fetchpriority="$1"');
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get("action") || "all";
  const supabase = createServerClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, original_url, content_en, content_zh, published_at, word_count");

  if (!articles) return NextResponse.json({ error: "No articles" });

  let updated = 0;
  for (const article of articles) {
    const updates: Record<string, unknown> = {};

    // Fix lazy-loaded images in content
    if (action === "all" || action === "images") {
      if (article.content_en && article.content_en.includes("data-lazy-src")) {
        updates.content_en = fixLazyImages(article.content_en);
      }
      if (article.content_zh) {
        let fixed = article.content_zh;
        if (fixed.includes("data-lazy-src")) {
          fixed = fixLazyImages(fixed);
        }
        // Fix translated HTML attributes
        fixed = fixTranslatedImgAttrs(fixed);
        if (fixed !== article.content_zh) {
          updates.content_zh = fixed;
        }
      }
    }

    // Fix missing published_at by scraping the page
    if ((action === "all" || action === "dates") && !article.published_at) {
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
    if ((action === "all" || action === "wordcount") && !article.word_count && article.content_en) {
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

  return NextResponse.json({ total: articles.length, updated, action });
}

export const maxDuration = 300;
