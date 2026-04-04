"use client";

import { useState, useRef, useEffect } from "react";

export default function TTSPlayer({
  textContent,
  lang,
}: {
  textContent: string;
  lang: "en" | "zh";
}) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "playing" | "paused" | "error"
  >("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  const cleanText = textContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  async function handlePlay() {
    // Resume if paused
    if (status === "paused" && audioRef.current) {
      try {
        await audioRef.current.play();
        setStatus("playing");
      } catch (e) {
        console.error("Resume failed:", e);
      }
      return;
    }

    // Stop any existing audio
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    setStatus("loading");

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      // 30 second timeout
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, lang }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error("TTS API error:", res.status);
        setStatus("error");
        return;
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        console.error("TTS returned empty audio");
        setStatus("error");
        return;
      }

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setStatus("idle");
        audioRef.current = null;
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };

      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setStatus("error");
      };

      await audio.play();
      setStatus("playing");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.error("TTS request timed out");
      } else {
        console.error("TTS error:", err);
      }
      setStatus("error");
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setStatus("idle");
  }

  return (
    <div className="flex items-center gap-2">
      {status === "idle" && (
        <button
          onClick={handlePlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          title="朗读文章"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          朗读
        </button>
      )}

      {status === "loading" && (
        <button
          onClick={handleStop}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border opacity-70 hover:opacity-100 transition-opacity"
          title="取消加载"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="animate-spin"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
          </svg>
          加载中...
        </button>
      )}

      {status === "error" && (
        <button
          onClick={handlePlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
          title="重新加载"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          加载失败，点击重试
        </button>
      )}

      {(status === "playing" || status === "paused") && (
        <>
          <button
            onClick={status === "paused" ? handlePlay : handlePause}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            {status === "paused" ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                继续
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                </svg>
                暂停
              </>
            )}
          </button>
          <button
            onClick={handleStop}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z" />
            </svg>
            停止
          </button>
        </>
      )}
    </div>
  );
}
