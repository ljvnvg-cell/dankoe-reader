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
            <div className="text-4xl font-bold text-accent/20 select-none">
              DK
            </div>
          )}
        </div>
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 text-xs text-muted mb-2">
            {date && <time>{date}</time>}
            {date && wordCount > 0 && <span>&middot;</span>}
            {wordCount > 0 && <span>{readTime} min</span>}
            {wordCount > 0 && (
              <>
                <span>&middot;</span>
                <span className="inline-flex items-center gap-0.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  {wordCount > 2000 ? "深度" : wordCount > 1000 ? "中篇" : "短篇"}
                </span>
              </>
            )}
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
