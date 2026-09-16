import { MockTTSProvider } from "./mock";
import { OpenAITTSProvider } from "./openai";
import type { TTSProvider } from "./types";

export type { TTSProvider, TTSResult } from "./types";

export function getTTSProvider(): TTSProvider {
  if (process.env.TTS_PROVIDER === "openai" && process.env.OPENAI_API_KEY) return new OpenAITTSProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_TTS_MODEL);
  return new MockTTSProvider();
}
