import Link from "next/link";
import type { Article } from "@/lib/supabase";

type Lang = "en" | "zh" | "dual";

export default function ArticleCard({
  article,
  lang,
}: {
  article: Article;
  lang: Lang;
}) {
  const title =
    lang === "zh"
      ? article.title_zh || article.title_en
      : article.title_en;

  const summary =
    lang === "zh"
      ? article.summary_zh || article.summary_en
      : article.summary_en;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const wordCount = article.word_count || 0;
  const readTime = Math.max(1, Math.round(wordCount / 200));
  const popularity = article.popularity || 0;
  const isSubstack = article.original_url?.includes("letters.thedankoe.com");
  // Show metric if meaningful: Substack likes (any > 0) or YouTube views (> 5000)
  const hasMetric = isSubstack ? popularity > 0 : popularity > 5000;
  const metricDisplay = hasMetric
    ? popularity >= 1_000_000
      ? (popularity / 1_000_000).toFixed(1) + "M"
      : popularity >= 1_000
      ? (popularity / 1_000).toFixed(1) + "K"
      : popularity.toString()
    : null;
  const metricLabel = isSubstack ? "likes" : "views";

  // Decode HTML entities in title
  const decodedTitle = title
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&amp;/g, "&");

  return (
    <Link href={`/article/${article.slug}`} className="block group">
      <article className="bg-card-bg border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 h-full flex flex-col">
        <div className="h-44 bg-accent/5 flex items-center justify-center overflow-hidden">
          {article.cover_image ? (
            <img
              src={article.cover_image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src="/dankoe-default-cover.jpg"
              alt="Dan Koe"
              className="w-full h-full object-cover opacity-70"
            />
          )}
        </div>
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center flex-wrap gap-2 text-xs text-muted mb-2">
            {metricDisplay && (
              <span className="text-accent font-medium">{metricDisplay} {metricLabel}</span>
            )}
            {metricDisplay && date && <span>&middot;</span>}
            {date && <time>{date}</time>}
            {date && wordCount > 0 && <span>&middot;</span>}
            {wordCount > 0 && <span>{readTime} min</span>}
          </div>
          <h2 className="text-lg font-bold mb-2 group-hover:text-accent transition-colors leading-snug">
            {decodedTitle}
          </h2>
          {lang === "dual" && article.title_zh && (
            <p className="text-sm text-muted mb-2">{article.title_zh}</p>
          )}
          <p className="text-sm text-muted line-clamp-2 mt-auto">{summary}</p>
        </div>
      </article>
    </Link>
  );
}
