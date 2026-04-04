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
    "idle" | "loading" | "playing" | "paused"
  >("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, lang }),
      });

      if (!res.ok) {
        console.error("TTS API error:", res.status);
        setStatus("idle");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      // Set up event handlers before playing
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
        setStatus("idle");
      };

      await audio.play();
      setStatus("playing");
    } catch (err) {
      console.error("TTS error:", err);
      setStatus("idle");
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
    }
  }

  function handleStop() {
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
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border opacity-50"
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

      {(status === "playing" || status === "paused") && (
        <>
          <button
            onClick={status === "paused" ? handlePlay : handlePause}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-card-bg transition-colors"
          >
            {status === "paused" ? (
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
            onClick={handleStop}
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
        </>
      )}
    </div>
  );
}
