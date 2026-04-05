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
  youtubeVideoId: string | null;
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

    // Strip <picture> wrappers and <source> tags — keep only <img> inside
    content = content.replace(
      /<picture[^>]*>[\s\S]*?(<img[\s\S]*?>)[\s\S]*?<\/picture>/gi,
      "$1"
    );
    // Remove orphan <source> tags
    content = content.replace(/<source[^>]*\/?>/gi, "");

    // Fix lazy-loaded images: replace placeholder src with real data-lazy-src
    content = content.replace(
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

    // Calculate word count
    const plainText = content.replace(/<[^>]+>/g, " ").trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;

    // Extract YouTube video ID if embedded
    const ytMatch = content.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    const youtubeVideoId = ytMatch?.[1] || null;

    return { title, content, publishedAt, wordCount, youtubeVideoId };
  } catch {
    return null;
  }
}

/**
 * Parse sitemap XML and return article URLs sorted by lastmod (newest first)
 */
async function fetchSitemapUrls(): Promise<string[]> {
  const entries: { url: string; lastmod: string }[] = [];

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

      // Extract URLs with lastmod from sitemap
      const urlBlocks = xml.matchAll(/<url>([\s\S]*?)<\/url>/g);
      for (const block of urlBlocks) {
        const locMatch = block[1].match(/<loc>([^<]+)<\/loc>/);
        const modMatch = block[1].match(/<lastmod>([^<]+)<\/lastmod>/);
        if (!locMatch) continue;
        const url = locMatch[1];
        if (url.endsWith("/letters/") || url.endsWith("/blog/")) continue;
        if (url.includes("/letters/") || url.includes("/blog/")) {
          entries.push({ url, lastmod: modMatch?.[1] || "2000-01-01" });
        }
      }
      console.log(`[sync] Found ${entries.length} URLs so far`);
    } catch (err) {
      console.error(`[sync] Sitemap fetch failed: ${err}`);
    }
  }

  // Sort by lastmod descending (newest first)
  entries.sort((a, b) => b.lastmod.localeCompare(a.lastmod));
  return entries.map((e) => e.url);
}

const SUBSTACK_API = "https://letters.thedankoe.com/api/v1";

type SubstackPost = {
  title: string;
  slug: string;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  url: string;
  likes: number;
  wordCount: number;
  youtubeVideoId: string | null;
};

/**
 * Fetch article list from Substack archive API (metadata only, no body)
 */
async function fetchSubstackArchive(): Promise<any[]> {
  const posts: any[] = [];
  let offset = 0;
  while (true) {
    try {
      const res = await fetch(
        `${SUBSTACK_API}/archive?sort=new&limit=50&offset=${offset}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      posts.push(...batch);
      offset += 50;
      if (batch.length < 50) break;
    } catch {
      break;
    }
  }
  return posts;
}

/**
 * Fetch full content of a single Substack post by slug
 */
async function fetchSubstackPost(slug: string): Promise<string> {
  try {
    // Substack renders content on the page — fetch the post page and extract
    const res = await fetch(`https://letters.thedankoe.com/p/${slug}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Substack puts post content in a div.body.markup
    const bodyMatch = html.match(
      /<div[^>]*class="[^"]*body markup[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*(?:subscription-widget|post-footer|footer)/i
    );
    if (bodyMatch) return bodyMatch[1].trim();

    // Fallback: look for available-content
    const contentMatch = html.match(
      /<div[^>]*class="[^"]*available-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*class="[^"]*(?:paywall|subscription)/i
    );
    if (contentMatch) return contentMatch[1].trim();

    // Fallback: try to extract from JSON embedded in page
    const jsonMatch = html.match(/"body_html"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (jsonMatch) {
      try {
        return JSON.parse(`"${jsonMatch[1]}"`);
      } catch {
        // ignore
      }
    }

    return "";
  } catch {
    return "";
  }
}

/**
 * Quick sync: check RSS + sitemap + Substack for new articles
 */
export async function syncArticles(limit = 0): Promise<SyncResult> {
  const supabase = createServerClient();
  const result: SyncResult = { total: 0, newArticles: 0, errors: [] };

  // Get existing article URLs and slugs to avoid duplicates
  const { data: existing } = await supabase
    .from("articles")
    .select("original_url, slug");
  const existingUrls = new Set(existing?.map((a) => a.original_url) || []);
  const existingSlugs = new Set(existing?.map((a) => a.slug) || []);

  // --- Source 1: Substack (newest content, post-2025-09) ---
  console.log("[sync] Fetching Substack archive...");
  const archive = await fetchSubstackArchive();
  console.log(`[sync] Found ${archive.length} Substack posts`);

  const newSubstack = archive.filter((p) => {
    const url =
      p.canonical_url || `https://letters.thedankoe.com/p/${p.slug}`;
    return !existingUrls.has(url) && !existingSlugs.has(p.slug);
  });
  console.log(`[sync] ${newSubstack.length} new Substack posts`);

  let remaining = limit > 0 ? limit : newSubstack.length;

  for (const p of newSubstack) {
    if (remaining <= 0) break;
    if (!p.title) continue;

    const url =
      p.canonical_url || `https://letters.thedankoe.com/p/${p.slug}`;
    console.log(`[sync] Fetching: ${p.title.slice(0, 50)}...`);

    // Fetch full content
    const content = await fetchSubstackPost(p.slug);
    if (!content) {
      result.errors.push(`Failed to fetch Substack content for "${p.title}"`);
      continue;
    }

    const plainText = content.replace(/<[^>]+>/g, " ").trim();
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    const likes = p.reactions?.["❤"] || 0;
    const publishedAt = p.post_date
      ? new Date(p.post_date).toISOString()
      : null;

    try {
      const summaryEn = extractSummary(content);

      let titleZh = "";
      let contentZh = "";
      let summaryZh = "";
      try {
        titleZh = await translateText(p.title);
        contentZh = await translateHTML(content);
        summaryZh = await translateText(summaryEn);
      } catch (translateErr) {
        result.errors.push(
          `Translation failed for "${p.title}": ${translateErr}`
        );
      }

      const { error } = await supabase.from("articles").insert({
        slug: p.slug,
        title_en: p.title,
        title_zh: titleZh || null,
        content_en: content,
        content_zh: contentZh || null,
        summary_en: summaryEn,
        summary_zh: summaryZh || null,
        cover_image: p.cover_image || null,
        original_url: url,
        published_at: publishedAt,
        word_count: wordCount,
        popularity: likes || wordCount,
      });

      if (error) {
        result.errors.push(
          `DB insert failed for "${p.title}": ${error.message}`
        );
      } else {
        result.newArticles++;
        remaining--;
        console.log(`[sync] Added: ${p.title.slice(0, 50)} (${likes} likes)`);
      }
    } catch (err) {
      result.errors.push(`Error processing Substack "${p.title}": ${err}`);
    }
  }

  // --- Source 2: WordPress (pre-2025-09 content) ---
  let rssUrls: string[] = [];
  try {
    const feed = await parser.parseURL(RSS_URL);
    rssUrls = feed.items.map((item) => item.link).filter(Boolean) as string[];
  } catch {
    // RSS failed
  }
  const sitemapUrls = await fetchSitemapUrls();
  const wpUrls = [...new Set([...rssUrls, ...sitemapUrls])];
  result.total = archive.length + wpUrls.length;

  // Refresh existing set after Substack inserts
  const { data: existingNow } = await supabase
    .from("articles")
    .select("original_url");
  const existingUrlsNow = new Set(
    existingNow?.map((a) => a.original_url) || []
  );

  let newWpUrls = wpUrls.filter((url) => !existingUrlsNow.has(url));
  if (remaining > 0 && limit > 0) newWpUrls = newWpUrls.slice(0, remaining);
  else if (limit > 0) newWpUrls = [];

  for (const url of newWpUrls) {
    const page = await fetchArticlePage(url);
    if (!page || !page.title || !page.content) {
      result.errors.push(`Failed to fetch content from ${url}`);
      continue;
    }

    try {
      const slug = slugify(page.title);
      const summaryEn = extractSummary(page.content);
      const coverImage = extractCoverImage(page.content);

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
        popularity: page.wordCount || 0,
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
