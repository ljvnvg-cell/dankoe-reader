"use client";

import { useEffect, useState } from "react";
import { supabase, type Article } from "@/lib/supabase";
import ArticleCard from "@/components/ArticleCard";
import LanguageToggle, { type Lang } from "@/components/LanguageToggle";

const PAGE_SIZE = 12;

type SortBy = "popularity" | "date";

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [lang, setLang] = useState<Lang>("zh");
  const [sortBy, setSortBy] = useState<SortBy>("popularity");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setArticles([]);
    setPage(0);
    loadArticles(0, sortBy);
  }, [sortBy]);

  async function loadArticles(pageNum: number, sort: SortBy) {
    setLoading(true);
    const from = pageNum * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const orderCol = sort === "popularity" ? "popularity" : "published_at";

    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order(orderCol, { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error("Failed to load articles:", error);
      setLoading(false);
      return;
    }

    if (pageNum === 0) {
      setArticles(data || []);
    } else {
      setArticles((prev) => [...prev, ...(data || [])]);
    }
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setPage(pageNum);
    setLoading(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Articles</h1>
          <p className="text-muted text-sm mt-1">
            Dan Koe 文章 · 中英双语阅读
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SortToggle sortBy={sortBy} onChange={setSortBy} />
          <LanguageToggle lang={lang} onChange={setLang} />
        </div>
      </div>

      {loading && articles.length === 0 ? (
        <div className="text-center py-20 text-muted">加载中...</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-lg">暂无文章</p>
          <p className="text-muted text-sm mt-2">
            请运行同步 API 从 Dan Koe 网站抓取文章
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} lang={lang} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-10">
              <button
                onClick={() => loadArticles(page + 1, sortBy)}
                disabled={loading}
                className="px-6 py-2 rounded-lg border border-border text-sm hover:bg-card-bg transition-colors disabled:opacity-50"
              >
                {loading ? "加载中..." : "加载更多"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SortToggle({
  sortBy,
  onChange,
}: {
  sortBy: SortBy;
  onChange: (s: SortBy) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
      <button
        onClick={() => onChange("popularity")}
        className={`px-3 py-1.5 transition-colors ${
          sortBy === "popularity"
            ? "bg-accent text-white"
            : "bg-card-bg text-muted hover:text-foreground"
        }`}
      >
        热门
      </button>
      <button
        onClick={() => onChange("date")}
        className={`px-3 py-1.5 transition-colors ${
          sortBy === "date"
            ? "bg-accent text-white"
            : "bg-card-bg text-muted hover:text-foreground"
        }`}
      >
        最新
      </button>
    </div>
  );
}
