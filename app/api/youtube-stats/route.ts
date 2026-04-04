import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * Extract YouTube video ID from article HTML content
 */
function extractYouTubeId(html: string): string | null {
  const match = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Format view count for display (e.g., 1234567 → "1.2M")
 */
function formatViews(count: number): string {
  if (count >= 1_000_000) return (count / 1_000_000).toFixed(1) + "M";
  if (count >= 1_000) return (count / 1_000).toFixed(1) + "K";
  return count.toString();
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not set" }, { status: 500 });
  }

  const supabase = createServerClient();
  const { data: articles } = await supabase
    .from("articles")
    .select("id, content_en, popularity");

  if (!articles) return NextResponse.json({ error: "No articles" });

  // Extract video IDs from all articles
  const articleVideoMap: { id: string; videoId: string; currentPop: number }[] = [];
  for (const article of articles) {
    if (!article.content_en) continue;
    const videoId = extractYouTubeId(article.content_en);
    if (videoId) {
      articleVideoMap.push({ id: article.id, videoId, currentPop: article.popularity || 0 });
    }
  }

  if (articleVideoMap.length === 0) {
    return NextResponse.json({ message: "No YouTube videos found", total: articles.length });
  }

  // Batch fetch YouTube stats (max 50 per request)
  let updated = 0;
  const batchSize = 50;

  for (let i = 0; i < articleVideoMap.length; i += batchSize) {
    const batch = articleVideoMap.slice(i, i + batchSize);
    const ids = batch.map((a) => a.videoId).join(",");

    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${apiKey}`,
        { signal: AbortSignal.timeout(15000), cache: "no-store" }
      );

      if (!res.ok) {
        console.error(`YouTube API error: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const statsMap = new Map<string, number>();
      for (const item of data.items || []) {
        const viewCount = parseInt(item.statistics?.viewCount || "0", 10);
        statsMap.set(item.id, viewCount);
      }

      // Update articles with view counts
      for (const article of batch) {
        const viewCount = statsMap.get(article.videoId);
        if (viewCount !== undefined && viewCount !== article.currentPop) {
          await supabase
            .from("articles")
            .update({ popularity: viewCount })
            .eq("id", article.id);
          updated++;
        }
      }
    } catch (err) {
      console.error(`YouTube API batch fetch failed:`, err);
    }
  }

  return NextResponse.json({
    total: articles.length,
    withVideo: articleVideoMap.length,
    updated,
  });
}

export const maxDuration = 60;
