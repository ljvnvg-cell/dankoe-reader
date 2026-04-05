import { NextRequest } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

function getCacheKey(text: string, lang: string): string {
  // Simple hash for cache key
  let hash = 0;
  const str = `${lang}:${text}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `${lang}/${Math.abs(hash).toString(36)}.mp3`;
}

export async function POST(request: NextRequest) {
  const { text, lang, segmentIndex } = await request.json();

  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  // Clean HTML tags
  const cleanText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  const cacheKey = getCacheKey(cleanText, lang || "en");

  // Check cache first
  try {
    const { data: cached } = await supabase.storage
      .from("tts-cache")
      .download(cacheKey);
    if (cached && cached.size > 0) {
      const buffer = Buffer.from(await cached.arrayBuffer());
      return new Response(buffer, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=604800",
          "X-TTS-Cache": "hit",
        },
      });
    }
  } catch {
    // Cache miss, generate fresh
  }

  const tts = new MsEdgeTTS();

  const voice =
    lang === "zh"
      ? "zh-CN-YunjianNeural"
      : "en-US-GuyNeural";

  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(cleanText);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("TTS timeout")), 45000);
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => { clearTimeout(timeout); resolve(); });
    audioStream.on("error", (err: Error) => { clearTimeout(timeout); reject(err); });
  });

  const audioBuffer = Buffer.concat(chunks);

  if (audioBuffer.length === 0) {
    return new Response("TTS returned empty audio", { status: 502 });
  }

  // Store in cache (fire-and-forget)
  supabase.storage
    .from("tts-cache")
    .upload(cacheKey, audioBuffer, {
      contentType: "audio/mpeg",
      upsert: true,
    })
    .catch(() => {}); // Ignore cache write errors

  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length.toString(),
      "Cache-Control": "public, max-age=604800",
      "X-TTS-Cache": "miss",
    },
  });
}

export const maxDuration = 60;
