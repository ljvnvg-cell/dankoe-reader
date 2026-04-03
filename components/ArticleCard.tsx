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
      : lang === "dual"
        ? `${article.title_en}\n${article.title_zh || ""}`
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

  return (
    <Link href={`/article/${article.slug}`} className="block group">
      <article className="bg-card-bg border border-border rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
        {article.cover_image && (
          <img
            src={article.cover_image}
            alt=""
            className="w-full h-48 object-cover rounded-lg mb-4"
          />
        )}
        <div className="flex items-center gap-2 text-xs text-muted">
          {date && <time>{date}</time>}
          {date && wordCount > 0 && <span>·</span>}
          {wordCount > 0 && <span>{readTime} min read</span>}
        </div>
        <h2 className="text-xl font-bold mt-1 mb-2 group-hover:text-accent transition-colors whitespace-pre-line">
          {title}
        </h2>
        {lang === "dual" && article.title_zh && (
          <p className="text-base text-muted mb-2">{article.title_zh}</p>
        )}
        <p className="text-sm text-muted line-clamp-3">{summary}</p>
      </article>
    </Link>
  );
}
