"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAllHighlights, deleteHighlight } from "@/lib/highlights";
import type { Highlight } from "@/lib/supabase";

type HighlightWithArticle = Highlight & {
  article?: { title_en: string; title_zh: string | null; slug: string };
};

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<HighlightWithArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllHighlights().then((data) => {
      setHighlights(data);
      setLoading(false);
    });
  }, []);

  async function handleDelete(id: string) {
    const ok = await deleteHighlight(id);
    if (ok) {
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-muted">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">My Highlights</h1>
      <p className="text-muted text-sm mb-8">
        {highlights.length} highlight{highlights.length !== 1 ? "s" : ""} saved
      </p>

      {highlights.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted text-lg">No highlights yet</p>
          <p className="text-muted text-sm mt-2">
            Select text in any article and click &ldquo;Highlight&rdquo; to save
            it here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {highlights.map((h) => (
            <div
              key={h.id}
              className="bg-card-bg border border-border rounded-xl p-5 group"
            >
              <blockquote className="text-foreground leading-relaxed border-l-3 border-accent pl-4 mb-3">
                {h.text_en || h.text_zh}
              </blockquote>
              {h.text_en && h.text_zh && (
                <p className="text-sm text-muted mb-3 pl-4">{h.text_zh}</p>
              )}
              <div className="flex items-center justify-between">
                {h.article ? (
                  <Link
                    href={`/article/${h.article.slug}`}
                    className="text-sm text-accent hover:underline"
                  >
                    {h.article.title_en}
                  </Link>
                ) : (
                  <span className="text-sm text-muted">Unknown article</span>
                )}
                <div className="flex items-center gap-3">
                  <time className="text-xs text-muted">
                    {new Date(h.created_at).toLocaleDateString()}
                  </time>
                  <button
                    onClick={() => handleDelete(h.id)}
                    className="text-xs text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
