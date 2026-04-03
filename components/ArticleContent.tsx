"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Article, Highlight } from "@/lib/supabase";
import type { Lang } from "./LanguageToggle";
import HighlightPopover from "./HighlightPopover";
import { getHighlightsForArticle, addHighlight } from "@/lib/highlights";

export default function ArticleContent({
  article,
  lang,
}: {
  article: Article;
  lang: Lang;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [popover, setPopover] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    getHighlightsForArticle(article.id).then(setHighlights);
  }, [article.id]);

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopover(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text || text.length < 3) {
      setPopover(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPopover({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      text,
    });
  }, []);

  const handleHighlight = useCallback(async () => {
    if (!popover) return;

    const isZh = lang === "zh";
    const result = await addHighlight({
      articleId: article.id,
      textEn: isZh ? null : popover.text,
      textZh: isZh ? popover.text : null,
      paragraphIndex: null,
    });

    if (result) {
      setHighlights((prev) => [...prev, result]);
    }
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [popover, article.id, lang]);

  const contentEn = article.content_en || "";
  const contentZh = article.content_zh || "";

  return (
    <div ref={contentRef} onMouseUp={handleMouseUp} className="relative">
      {lang === "dual" ? (
        <div className="space-y-6">
          <DualContent htmlEn={contentEn} htmlZh={contentZh} />
        </div>
      ) : (
        <div
          className="article-content"
          dangerouslySetInnerHTML={{
            __html: lang === "zh" ? contentZh || contentEn : contentEn,
          }}
        />
      )}

      {popover && (
        <HighlightPopover
          x={popover.x}
          y={popover.y}
          onHighlight={handleHighlight}
          onDismiss={() => setPopover(null)}
        />
      )}
    </div>
  );
}

/**
 * Dual language display - alternating English and Chinese paragraphs
 */
function DualContent({ htmlEn, htmlZh }: { htmlEn: string; htmlZh: string }) {
  const parasEn = splitParagraphs(htmlEn);
  const parasZh = splitParagraphs(htmlZh);
  const maxLen = Math.max(parasEn.length, parasZh.length);

  return (
    <>
      {Array.from({ length: maxLen }, (_, i) => (
        <div key={i} className="mb-6">
          {parasEn[i] && (
            <div
              className="article-content text-foreground"
              dangerouslySetInnerHTML={{ __html: parasEn[i] }}
            />
          )}
          {parasZh[i] && (
            <div
              className="article-content text-muted mt-2 pl-4 border-l-2 border-accent/30"
              dangerouslySetInnerHTML={{ __html: parasZh[i] }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function splitParagraphs(html: string): string[] {
  if (!html) return [];
  // Split on block-level closing tags
  const parts = html
    .split(/(?<=<\/(?:p|h[1-6]|li|blockquote|div)>)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}
