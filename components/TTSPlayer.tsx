"use client";

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Split text into segments of ~500 chars at sentence boundaries
 * for faster TTS response (first audio plays quickly)
 */
function splitTextSegments(html: string, maxLen = 500): string[] {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLen) return [text];

  const segments: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      segments.push(remaining);
      break;
    }
    // Find sentence boundary near maxLen
    let cutoff = maxLen;
    const sentenceEnd = remaining.slice(0, maxLen).search(/[。！？.!?]\s*(?=.)/);
    if (sentenceEnd > maxLen * 0.3) {
      cutoff = sentenceEnd + 1;
    }
    segments.push(remaining.slice(0, cutoff).trim());
    remaining = remaining.slice(cutoff).trim();
  }

  return segments.filter((s) => s.length > 0);
}

export default function TTSPlayer({
  textContent,
  lang,
}: {
  textContent: string;
  lang: "en" | "zh";
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentsRef = useRef<string[]>([]);
  const currentSegRef = useRef(0);
  const stoppedRef = useRef(false);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setProgress("");
    currentSegRef.current = 0;
  }, []);

  const playSegment = useCallback(
    async (index: number) => {
      const segments = segmentsRef.current;
      if (index >= segments.length || stoppedRef.current) {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress("");
        return;
      }

      setProgress(`${index + 1}/${segments.length}`);
      currentSegRef.current = index;

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: segments[index], lang }),
        });

        if (!res.ok || stoppedRef.current) return;

        const blob = await res.blob();
        if (stoppedRef.current) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (!stoppedRef.current) {
            playSegment(index + 1);
          }
        };

        audioRef.current = audio;
        if (index === 0) {
          setIsLoading(false);
          setIsPlaying(true);
        }
        await audio.play();
      } catch (err) {
        console.error("TTS error:", err);
        setIsPlaying(false);
        setIsLoading(false);
      }
    },
    [lang]
  );

  const play = useCallback(async () => {
    if (isPaused && audioRef.current) {
      audioRef.current.play();
      setIsPaused(false);
      return;
    }

    stop();
    stoppedRef.current = false;
    setIsLoading(true);

    segmentsRef.current = splitTextSegments(textContent);
    playSegment(0);
  }, [textContent, isPaused, stop, playSegment]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      {!isPlaying ? (
        <button
          onClick={play}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors disabled:opacity-50"
          title="朗读文章"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          {isLoading ? "加载中..." : "朗读"}
        </button>
      ) : (
        <>
          <button
            onClick={isPaused ? play : pause}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            {isPaused ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                继续
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
                暂停
              </>
            )}
          </button>
          <button
            onClick={stop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M6 6h12v12H6z" />
            </svg>
            停止
          </button>
          {progress && (
            <span className="text-xs text-muted">{progress}</span>
          )}
        </>
      )}
    </div>
  );
}
