"use client";

import { useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/supabase";
import LanguageToggle, { type Lang } from "@/components/LanguageToggle";
import ArticleContent from "@/components/ArticleContent";
import TTSPlayer from "@/components/TTSPlayer";

export default function ArticleDetail({ article }: { article: Article }) {
  const [lang, setLang] = useState<Lang>("zh");

  const title =
    lang === "zh"
      ? article.title_zh || article.title_en
      : article.title_en;

  const ttsContent =
    lang === "zh"
      ? article.content_zh || article.content_en
      : article.content_en;

  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const wordCount = article.word_count || 0;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  // Decode HTML entities
  const decodedTitle = title
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#8220;/g, "\u201c")
    .replace(/&#8221;/g, "\u201d")
    .replace(/&#8230;/g, "\u2026")
    .replace(/&amp;/g, "&");

  return (
    <article className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; 返回文章列表
        </Link>
      </div>

      <header className="mb-10 pb-8 border-b border-border">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight mb-3">
          {decodedTitle}
        </h1>
        {lang === "dual" && article.title_zh && (
          <h2 className="text-xl text-muted mb-3">{article.title_zh}</h2>
        )}
        <div className="flex items-center gap-2 text-sm text-muted mb-4">
          {date && <time>Dan Koe &middot; {date}</time>}
          {wordCount > 0 && <span>&middot; {readTime} min read</span>}
        </div>
        <div className="flex items-center gap-4">
          <LanguageToggle lang={lang} onChange={setLang} />
          <TTSPlayer
            textContent={ttsContent}
            lang={lang === "zh" ? "zh" : "en"}
          />
          <a
            href={article.original_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted hover:text-accent transition-colors ml-auto"
          >
            原文 &rarr;
          </a>
        </div>
      </header>

      <ArticleContent article={article} lang={lang} />
    </article>
  );
}
