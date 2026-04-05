"use client";

import { useState, useRef, useEffect } from "react";

// Split text into segments at sentence boundaries
function splitSegments(text: string, maxLen = 1500): string[] {
  if (text.length <= maxLen) return [text];
  const segments: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      segments.push(remaining);
      break;
    }
    let cut = -1;
    for (const sep of ["。", ".", "！", "!", "？", "?", "；", ";", "\n"]) {
      const idx = remaining.lastIndexOf(sep, maxLen);
      if (idx > maxLen * 0.3 && idx > cut) cut = idx + 1;
    }
    if (cut <= 0) {
      const spaceIdx = remaining.lastIndexOf(" ", maxLen);
      const commaIdx = Math.max(
        remaining.lastIndexOf(",", maxLen),
        remaining.lastIndexOf("，", maxLen)
      );
      cut = Math.max(spaceIdx, commaIdx);
      if (cut <= 0) cut = maxLen;
    }
    segments.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return segments.filter((s) => s.length > 0);
}

type Status = "idle" | "loading" | "playing" | "paused" | "error";

export default function TTSPlayer({
  textContent,
  lang,
}: {
  textContent: string;
  lang: "en" | "zh";
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const segmentsRef = useRef<string[]>([]);
  const blobsRef = useRef<(Blob | null)[]>([]);
  const playingIdxRef = useRef(0);

  const cleanText = textContent
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 15000);

  useEffect(() => {
    return () => stopAll();
  }, []);

  function stopAll() {
    abortRef.current?.abort();
    abortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];
    blobsRef.current = [];
    playingIdxRef.current = 0;
  }

  function playSegment(idx: number) {
    const segs = segmentsRef.current;
    if (idx >= segs.length) {
      // All done
      setStatus("idle");
      setProgress("");
      stopAll();
      return;
    }

    const blob = blobsRef.current[idx];
    if (!blob) {
      // Not loaded yet — wait and retry
      setProgress(`加载第 ${idx + 1}/${segs.length} 段...`);
      const timer = setInterval(() => {
        if (abortRef.current?.signal.aborted) {
          clearInterval(timer);
          return;
        }
        if (blobsRef.current[idx]) {
          clearInterval(timer);
          playSegment(idx);
        }
      }, 200);
      return;
    }

    const url = URL.createObjectURL(blob);
    blobUrlsRef.current.push(url);
    const audio = new Audio(url);
    audioRef.current = audio;
    playingIdxRef.current = idx;

    if (segs.length > 1) {
      setProgress(`${idx + 1}/${segs.length} 段`);
    } else {
      setProgress("");
    }

    audio.onended = () => {
      playSegment(idx + 1);
    };
    audio.onerror = () => {
      // Skip failed segment
      playSegment(idx + 1);
    };

    audio.play().then(() => setStatus("playing")).catch(() => {
      setStatus("error");
      setProgress("播放失败");
    });
  }

  async function handlePlay() {
    // Resume from pause
    if (status === "paused" && audioRef.current) {
      try {
        await audioRef.current.play();
        setStatus("playing");
      } catch {
        // ignore
      }
      return;
    }

    stopAll();
    const segments = splitSegments(cleanText);
    segmentsRef.current = segments;
    blobsRef.current = new Array(segments.length).fill(null);

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setProgress(`加载第 1/${segments.length} 段...`);

    // Load segments sequentially, start playing after first is ready
    let started = false;

    for (let i = 0; i < segments.length; i++) {
      if (controller.signal.aborted) return;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: segments[i], lang }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        blobsRef.current[i] = blob;

        if (!started) {
          started = true;
          playSegment(0);
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (i === 0) {
          setStatus("error");
          setProgress("加载失败，点击重试");
          return;
        }
        // Non-first segment: put empty blob so playback continues
        blobsRef.current[i] = new Blob([], { type: "audio/mpeg" });
      }
    }
  }

  function handlePause() {
    if (audioRef.current) {
      audioRef.current.pause();
      setStatus("paused");
    }
  }

  function handleStop() {
    stopAll();
    setStatus("idle");
    setProgress("");
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
            <circle
              cx="12"
              cy="12"
              r="10"
              strokeDasharray="60"
              strokeDashoffset="20"
            />
          </svg>
          {progress || "加载中..."}
        </button>
      )}

      {status === "error" && (
        <button
          onClick={handlePlay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-500 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 transition-colors"
          title="重新加载"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
          {progress && (
            <span className="text-xs text-muted">{progress}</span>
          )}
        </>
      )}
    </div>
  );
}
