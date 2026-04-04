import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

function fixImages(html: string): string {
  // Step 1: Strip <picture> wrappers and <source> tags, keep only <img>
  let result = html.replace(
    /<picture[^>]*>[\s\S]*?(<img[\s\S]*?>)[\s\S]*?<\/picture>/gi,
    "$1"
  );
  result = result.replace(/<source[^>]*\/?>/gi, "");

  // Step 2: Fix lazy-loaded images
  result = result.replace(
    /<img([^>]*)src="data:image\/svg\+xml[^"]*"([^>]*)data-lazy-src="([^"]+)"([^>]*)\/?\s*>/gi,
    (_, before, mid, realSrc, after) => {
      const cleanAttrs = `${before}${mid}${after}`
        .replace(/data-lazy-src="[^"]*"/g, "")
        .replace(/data-lazy-srcset="[^"]*"/g, "")
        .replace(/data-lazy-sizes="[^"]*"/g, "")
        .replace(/\s+/g, " ");
      return `<img src="${realSrc}"${cleanAttrs}/>`;
    }
  );

  return result;
}

/**
 * Extract clean img tags from English content, then replace
 * all img tags (including mangled ones) in Chinese content
 * with the English originals in order.
 */
function fixZhImages(contentEn: string, contentZh: string): string {
  // Get all clean img tags from English content
  const enImgs = contentEn.match(/<img\s[^>]+>/gi) || [];
  if (enImgs.length === 0) return contentZh;

  // Match both normal and mangled img tags in Chinese content
  // Mangled: <img解码=, <img 加载=, <img src=, etc.
  const zhImgPattern =
    /<img(?:\s|[^\s>a-zA-Z])[^>]*>/gi;
  const zhImgs = contentZh.match(zhImgPattern) || [];

  if (zhImgs.length === 0) return contentZh;

  // Replace each zh img tag with the corresponding en one
  let idx = 0;
  return contentZh.replace(zhImgPattern, () => {
    if (idx < enImgs.length) {
      return enImgs[idx++];
    }
    return enImgs[enImgs.length - 1] || "";
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data: articles } = await supabase
    .from("articles")
    .select(
      "id, original_url, content_en, content_zh, published_at, word_count"
    );

  if (!articles) return NextResponse.json({ error: "No articles" });

  let updated = 0;
  for (const article of articles) {
    const updates: Record<string, unknown> = {};

    // Step 1: Fix images in English content (lazy-load + picture/source tags)
    if (article.content_en) {
      let fixedEn = article.content_en;
      if (
        fixedEn.includes("data-lazy-src") ||
        fixedEn.includes("<picture") ||
        fixedEn.includes("<source")
      ) {
        fixedEn = fixImages(fixedEn);
      }
      // Nuclear fallback strip
      fixedEn = fixedEn.replace(/<\/?picture[^>]*>/gi, "");
      fixedEn = fixedEn.replace(/<source[^>]*\/?>/gi, "");
      if (fixedEn !== article.content_en) {
        updates.content_en = fixedEn;
      }
    }

    // Step 2: Fix Chinese content — apply same image fixes, then
    // replace any remaining broken img tags with clean ones from English
    if (article.content_zh) {
      let fixedZh = article.content_zh;
      if (
        fixedZh.includes("data-lazy-src") ||
        fixedZh.includes("<picture") ||
        fixedZh.includes("<source")
      ) {
        fixedZh = fixImages(fixedZh);
      }
      const cleanEn =
        (updates.content_en as string) || article.content_en || "";
      if (cleanEn) {
        fixedZh = fixZhImages(cleanEn, fixedZh);
      }
      // Nuclear fallback: strip any remaining <picture>/<source> tags
      // that survived the regex-based fixImages (e.g. malformed ZH HTML)
      fixedZh = fixedZh.replace(/<\/?picture[^>]*>/gi, "");
      fixedZh = fixedZh.replace(/<source[^>]*\/?>/gi, "");
      if (fixedZh !== article.content_zh) {
        updates.content_zh = fixedZh;
      }
    }

    // Step 3: Fix missing published_at
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

    // Step 4: Fix missing word_count
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
