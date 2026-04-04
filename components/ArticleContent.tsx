"use client";

import { useEffect, useRef, useState, useCallback, memo } from "react";
import type { Article, Highlight } from "@/lib/supabase";
import type { Lang } from "./LanguageToggle";
import HighlightPopover from "./HighlightPopover";
import { getHighlightsForArticle, addHighlight } from "@/lib/highlights";

/**
 * Walk the DOM and wrap matching text with <mark> tags
 */
function applyHighlightsToDOM(
  container: HTMLElement,
  highlights: Highlight[]
) {
  if (highlights.length === 0) return;

  for (const h of highlights) {
    const text = h.text_zh || h.text_en;
    if (!text || text.length < 2) continue;

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToProcess: { node: Text; index: number }[] = [];
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(text) ?? -1;
      if (idx >= 0) {
        nodesToProcess.push({ node, index: idx });
      }
    }

    // Process in reverse to avoid invalidating earlier nodes
    for (let i = nodesToProcess.length - 1; i >= 0; i--) {
      const { node: textNode, index } = nodesToProcess[i];
      const parent = textNode.parentNode;
      if (!parent) continue;
      // Don't re-highlight already highlighted text
      if (
        parent instanceof HTMLElement &&
        parent.classList.contains("user-highlight")
      )
        continue;

      const before = textNode.textContent!.slice(0, index);
      const match = textNode.textContent!.slice(index, index + text.length);
      const after = textNode.textContent!.slice(index + text.length);

      const frag = document.createDocumentFragment();
      if (before) frag.appendChild(document.createTextNode(before));

      const mark = document.createElement("mark");
      mark.className = "user-highlight";
      mark.textContent = match;
      frag.appendChild(mark);

      if (after) frag.appendChild(document.createTextNode(after));

      parent.replaceChild(frag, textNode);
    }
  }
}

/**
 * Memoized article HTML renderer — prevents re-render when popover state changes,
 * which would destroy the DOM and clear the user's text selection.
 */
const ArticleHTML = memo(function ArticleHTML({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  return (
    <div
      className={className || "article-content"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * Memoized dual content renderer
 */
const DualContent = memo(function DualContent({
  htmlEn,
  htmlZh,
}: {
  htmlEn: string;
  htmlZh: string;
}) {
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
});

function splitParagraphs(html: string): string[] {
  if (!html) return [];
  const parts = html
    .split(/(?<=<\/(?:p|h[1-6]|li|blockquote|div)>)/gi)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts;
}

export default function ArticleContent({
  article,
  lang,
}: {
  article: Article;
  lang: Lang;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  // Use ref for popover state to avoid re-rendering content area
  const [popover, setPopover] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    getHighlightsForArticle(article.id).then(setHighlights);
  }, [article.id]);

  // Apply highlights to the DOM after rendering
  useEffect(() => {
    if (contentRef.current && highlights.length > 0) {
      // Small delay to ensure content is rendered
      const timer = setTimeout(() => {
        if (contentRef.current) {
          // Remove existing marks first
          contentRef.current
            .querySelectorAll("mark.user-highlight")
            .forEach((mark) => {
              const parent = mark.parentNode;
              if (parent) {
                parent.replaceChild(
                  document.createTextNode(mark.textContent || ""),
                  mark
                );
                parent.normalize(); // Merge adjacent text nodes
              }
            });
          applyHighlightsToDOM(contentRef.current, highlights);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlights, lang]);

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
    // Do NOT clear selection here — user needs to see it
  }, []);

  const handleHighlight = useCallback(async () => {
    if (!popover) return;

    const textToSave = popover.text;
    const isZh = lang === "zh" || lang === "dual";

    // Close popover and clear selection
    setPopover(null);
    window.getSelection()?.removeAllRanges();

    try {
      const result = await addHighlight({
        articleId: article.id,
        textEn: isZh ? null : textToSave,
        textZh: isZh ? textToSave : null,
        paragraphIndex: null,
      });

      if (result) {
        setHighlights((prev) => [...prev, result]);
      }
    } catch (err) {
      console.error("Highlight save failed:", err);
    }
  }, [popover, article.id, lang]);

  const contentEn = article.content_en || "";
  const contentZh = article.content_zh || "";
  const displayHtml = lang === "zh" ? contentZh || contentEn : contentEn;

  return (
    <div className="relative">
      {highlights.length > 0 && (
        <div className="mb-4 px-3 py-2 bg-highlight/20 rounded-lg text-sm text-muted">
          已划线 {highlights.length} 处
        </div>
      )}

      <div ref={contentRef} onMouseUp={handleMouseUp}>
        {lang === "dual" ? (
          <div className="space-y-6">
            <DualContent htmlEn={contentEn} htmlZh={contentZh} />
          </div>
        ) : (
          <ArticleHTML html={displayHtml} />
        )}
      </div>

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
