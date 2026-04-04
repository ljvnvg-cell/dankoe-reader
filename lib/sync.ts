import Parser from "rss-parser";
import { createServerClient } from "./supabase";
import { translateText, translateHTML } from "./translate";

const RSS_URL = "https://thedankoe.com/feed/";
const SITEMAPS = [
  "https://thedankoe.com/letters-sitemap.xml",
  "https://thedankoe.com/post-sitemap.xml",
];

const parser = new Parser({
  customFields: {
    item: ["content:encoded", "enclosure"],
  },
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function extractSummary(html: string, maxLength = 200): string {
  const text = html.replace(/<[^>]+>/g, "").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "") + "...";
}

function extractCoverImage(html: string): string | null {
  const imgMatch = html.match(/<img[^>]+src="([^"]+)"/);
  return imgMatch ? imgMatch[1] : null;
}

export type SyncResult = {
  total: number;
  newArticles: number;
  errors: string[];
};

/**
 * Fetch article content from a URL by scraping the page
 */
async function fetchArticlePage(url: string): Promise<{
  title: string;
  content: string;
  publishedAt: string | null;
  wordCount: number;
} | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
      : "";

    // Extract article content - Dan Koe uses Elementor with theme-post-content
    let content = "";

    // Strategy 1: Elementor post-content widget
    const elementorMatch = html.match(
      /elementor-widget-theme-post-content[^>]*>\s*<div[^>]*class="elementor-widget-container"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i
    );
    if (elementorMatch) {
      content = elementorMatch[1].trim();
    }

    // Strategy 2: entry-content
    if (!content) {
      const entryMatch = html.match(
        /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/|<div[^>]*class="[^"]*(?:post-tags|author|related|comments|share))/i
      );
      content = entryMatch ? entryMatch[1].trim() : "";
    }

    // Strategy 3: article tag
    if (!content) {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
      content = articleMatch ? articleMatch[1].trim() : "";
    }

    // Extract published date from JSON-LD (more reliable)
    const jsonLdDate = html.match(/"datePublished":"([^"]+)"/);
    const timeDate = html.match(/<time[^>]*datetime="([^"]+)"/i);
    const dateStr = jsonLdDate?.[1] || timeDate?.[1] || null;
    const publishedAt = dateStr ? new Date(dateStr).toISOString() : null;

    // Fix lazy-loaded images: replace placeholder src with real data-lazy-src
    content = content.replace(
      /<img([^>]*)src="data:image\/svg\+xml[^"]*"([^>]*)data-lazy-src="([^"]+)"([^>]*)\/?\s*>/gi,
      (_, before, mid, realSrc, after) => {
        // Also grab data-lazy-srcset for responsive images
        const srcsetMatch = `${before}${mid}${after}`.match(/data-lazy-srcset="([^"]+)"/);
        const srcset = srcsetMatch ? ` srcset="${srcsetMatch[1]}"` : "";
        // Clean up lazy attributes
        const cleanAttrs = `${before}${mid}${after}`
          .replace(/data-lazy-src="[^"]*"/g, "")
          .replace(/data-lazy-srcset="[^"]*"/g, "")
          .replace(/data-lazy-sizes="[^"]*"/g, "")
          .replace(/\s+/g, " ");
        return `<img src="${realSrc}"${srcset}${cleanAttrs}/>`;
      }
    );

    // Calculate word count for popularity estimation
    const plainText = content.replace(/<[^>]+>/g, " ").trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    return { title, content, publishedAt, wordCount };
  } catch {
    return null;
  }
}

/**
 * Parse sitemap XML and return article URLs
 */
async function fetchSitemapUrls(): Promise<string[]> {
  const urls: string[] = [];

  for (const sitemapUrl of SITEMAPS) {
    try {
      console.log(`[sync] Fetching sitemap: ${sitemapUrl}`);
      const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(30000), cache: "no-store" });
      if (!res.ok) {
        console.log(`[sync] Sitemap returned ${res.status}`);
        continue;
      }
      const xml = await res.text();
      console.log(`[sync] Sitemap size: ${xml.length} bytes`);

      // Extract URLs from sitemap
      const locMatches = xml.matchAll(/<loc>([^<]+)<\/loc>/g);
      for (const match of locMatches) {
        const url = match[1];
        // Skip index pages like /letters/
        if (url.endsWith("/letters/") || url.endsWith("/blog/")) continue;
        if (url.includes("/letters/") || url.includes("/blog/")) {
          urls.push(url);
        }
      }
      console.log(`[sync] Found ${urls.length} URLs so far`);
    } catch (err) {
      console.error(`[sync] Sitemap fetch failed: ${err}`);
    }
  }

  return urls;
}

/**
 * Quick sync: check RSS for new articles (daily cron)
 */
export async function syncArticles(limit = 0): Promise<SyncResult> {
  const supabase = createServerClient();
  const result: SyncResult = { total: 0, newArticles: 0, errors: [] };

  // Try RSS first for recent articles
  let rssUrls: string[] = [];
  try {
    const feed = await parser.parseURL(RSS_URL);
    rssUrls = feed.items.map((item) => item.link).filter(Boolean) as string[];
  } catch {
    // RSS failed, will fall back to sitemap
  }

  // Also get all URLs from sitemap
  const sitemapUrls = await fetchSitemapUrls();

  // Merge and deduplicate
  const allUrls = [...new Set([...rssUrls, ...sitemapUrls])];
  result.total = allUrls.length;

  if (allUrls.length === 0) {
    result.errors.push("No article URLs found from RSS or sitemap");
    return result;
  }

  // Get existing article URLs to avoid duplicates
  const { data: existing } = await supabase
    .from("articles")
    .select("original_url");
  const existingUrls = new Set(existing?.map((a) => a.original_url) || []);

  // Filter to only new articles
  let newUrls = allUrls.filter((url) => !existingUrls.has(url));
  if (limit > 0) newUrls = newUrls.slice(0, limit);

  for (const url of newUrls) {
    const page = await fetchArticlePage(url);
    if (!page || !page.title || !page.content) {
      result.errors.push(`Failed to fetch content from ${url}`);
      continue;
    }

    try {
      const slug = slugify(page.title);
      const summaryEn = extractSummary(page.content);
      const coverImage = extractCoverImage(page.content);

      // Translate
      let titleZh = "";
      let contentZh = "";
      let summaryZh = "";
      try {
        titleZh = await translateText(page.title);
        contentZh = await translateHTML(page.content);
        summaryZh = await translateText(summaryEn);
      } catch (translateErr) {
        result.errors.push(
          `Translation failed for "${page.title}": ${translateErr}`
        );
      }

      // Popularity score: word count as base (longer = more in-depth)
      const popularity = page.wordCount || 0;

      const { error } = await supabase.from("articles").insert({
        slug,
        title_en: page.title,
        title_zh: titleZh || null,
        content_en: page.content,
        content_zh: contentZh || null,
        summary_en: summaryEn,
        summary_zh: summaryZh || null,
        cover_image: coverImage,
        original_url: url,
        published_at: page.publishedAt,
        word_count: page.wordCount || 0,
        popularity,
      });

      if (error) {
        result.errors.push(
          `DB insert failed for "${page.title}": ${error.message}`
        );
      } else {
        result.newArticles++;
      }
    } catch (err) {
      result.errors.push(`Error processing ${url}: ${err}`);
    }
  }

  return result;
}
