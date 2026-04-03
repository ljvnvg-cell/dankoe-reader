"use client";

import { useEffect, useRef } from "react";

export default function HighlightPopover({
  x,
  y,
  onHighlight,
  onDismiss,
}: {
  x: number;
  y: number;
  onHighlight: () => void;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    // Use setTimeout to avoid immediate dismissal
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onDismiss]);

  return (
    <div
      ref={ref}
      className="fixed z-50 -translate-x-1/2 -translate-y-full"
      style={{ left: x, top: y }}
      // Prevent mousedown from clearing the text selection
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        onMouseDown={(e) => {
          e.preventDefault(); // Keep selection alive
          onHighlight();
        }}
        className="bg-foreground text-background px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg hover:opacity-90 transition-opacity flex items-center gap-1.5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.243 2.828a2.828 2.828 0 114 4L7.414 18.657a1 1 0 01-.464.263l-4.243 1.06a.5.5 0 01-.607-.607l1.06-4.242a1 1 0 01.264-.465L15.243 2.828z" />
        </svg>
        划线
      </button>
    </div>
  );
}
