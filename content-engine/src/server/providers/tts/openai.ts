import OpenAI from "openai";
import type { TTSProvider, TTSResult } from "./types";
import { probeDurationMs } from "@/server/render/ffmpeg";

export class OpenAITTSProvider implements TTSProvider {
  readonly name = "openai";
  private client: OpenAI;
  constructor(apiKey: string, private model = "gpt-4o-mini-tts") {
    this.client = new OpenAI({ apiKey });
  }
  async synthesize(text: string, opts: { voice?: string; speed?: number } = {}): Promise<TTSResult> {
    const res = await this.client.audio.speech.create({ model: this.model, voice: (opts.voice as "alloy") || "alloy", input: text, speed: opts.speed ?? 1, response_format: "mp3" });
    const audio = Buffer.from(await res.arrayBuffer());
    const durationMs = await probeDurationMs(audio, "mp3");
    return { audio, mimeType: "audio/mpeg", durationMs, ext: "mp3" };
  }
}
