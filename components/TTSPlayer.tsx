"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export default function TTSPlayer({
  textContent,
  lang,
}: {
  textContent: string;
  lang: "en" | "zh";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stop = useCallback(() => {
    speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  const play = useCallback(() => {
    if (isPaused) {
      speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    stop();

    // Clean HTML tags for speech
    const clean = textContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = lang === "zh" ? "zh-CN" : "en-US";
    utterance.rate = lang === "zh" ? 0.9 : 1;

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }, [textContent, lang, isPaused, stop]);

  const pause = useCallback(() => {
    speechSynthesis.pause();
    setIsPaused(true);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {!isPlaying ? (
        <button
          onClick={play}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          title="Listen to article"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Listen
        </button>
      ) : (
        <>
          <button
            onClick={isPaused ? play : pause}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            {isPaused ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Resume
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
                Pause
              </>
            )}
          </button>
          <button
            onClick={stop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            Stop
          </button>
        </>
      )}
    </div>
  );
}
