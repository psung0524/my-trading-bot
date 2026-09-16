import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { TTSProvider, TTSResult } from "./types";
import { probeDurationMs } from "@/server/render/ffmpeg";

/**
 * Microsoft Edge "소리내어 읽기" 음성 (무료, 키 불필요). 한국어 기본 음성: ko-KR-SunHiNeural(여), ko-KR-InJoonNeural(남).
 * 서버 사이드에서만 동작한다. 네트워크가 막힌 환경에서는 실패하며, 그 경우 TTS_PROVIDER=mock으로 두면 된다.
 */
export const EDGE_VOICES: Record<string, string> = {
  default: "ko-KR-SunHiNeural",
  female: "ko-KR-SunHiNeural",
  male: "ko-KR-InJoonNeural",
  "ko-female": "ko-KR-SunHiNeural",
  "ko-male": "ko-KR-InJoonNeural",
};

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export class EdgeTTSProvider implements TTSProvider {
  readonly name = "edge";
  async synthesize(text: string, opts: { voice?: string; speed?: number } = {}): Promise<TTSResult> {
    const voice = EDGE_VOICES[opts.voice ?? "default"] ?? (opts.voice?.startsWith("ko-KR-") ? opts.voice : EDGE_VOICES.default);
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const rate = opts.speed && opts.speed !== 1 ? `${Math.round((opts.speed - 1) * 100)}%` : undefined;
    const { audioStream } = tts.toStream(escapeXml(text), rate ? { rate } : undefined);
    const chunks: Buffer[] = [];
    const audio: Buffer = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Edge TTS 응답 시간 초과(30초)")), 30_000);
      audioStream.on("data", (d: Buffer) => chunks.push(Buffer.from(d)));
      audioStream.on("close", () => {
        clearTimeout(timer);
        resolve(Buffer.concat(chunks));
      });
      audioStream.on("error", (e: Error) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    if (audio.length < 1000) throw new Error("Edge TTS가 빈 음성을 반환했습니다. 네트워크(speech.platform.bing.com) 접근을 확인하세요");
    const durationMs = await probeDurationMs(audio, "mp3");
    return { audio, mimeType: "audio/mpeg", durationMs, ext: "mp3" };
  }
}
