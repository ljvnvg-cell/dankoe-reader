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
    ? new Date(article.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <article>
      <div className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          &larr; 返回文章列表
        </Link>
      </div>

      <header className="mb-8">
        <time className="text-sm text-muted">{date}</time>
        <h1 className="text-3xl font-bold mt-2 mb-1">{title}</h1>
        {lang === "dual" && article.title_zh && (
          <h2 className="text-xl text-muted">{article.title_zh}</h2>
        )}
        <div className="flex items-center gap-4 mt-4">
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
