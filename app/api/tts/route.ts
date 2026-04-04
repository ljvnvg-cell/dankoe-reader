import { NextRequest } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export async function POST(request: NextRequest) {
  const { text, lang } = await request.json();

  if (!text || typeof text !== "string") {
    return new Response("Missing text", { status: 400 });
  }

  // Clean HTML tags
  const cleanText = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000); // Limit length

  const tts = new MsEdgeTTS();

  // Use natural male voices to match the original author (Dan Koe)
  const voice =
    lang === "zh"
      ? "zh-CN-YunjianNeural" // Male, natural Chinese
      : "en-US-GuyNeural"; // Male, natural English

  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(cleanText);

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    audioStream.on("end", () => resolve());
    audioStream.on("error", (err: Error) => reject(err));
  });

  const audioBuffer = Buffer.concat(chunks);

  return new Response(audioBuffer, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length.toString(),
      "Cache-Control": "public, max-age=86400",
    },
  });
}

export const maxDuration = 60;
