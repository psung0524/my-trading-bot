import type { TTSProvider, TTSResult } from "./types";
import { pcmToWav, SAMPLE_RATE } from "./wav";

/**
 * Mock TTS: 글자 수에 비례한 길이의 조용한 톤(음절 느낌)을 만든다. 실제 음성은 아니지만
 * 길이 분석·타이밍 조정·합성 파이프라인을 그대로 검증할 수 있다.
 */
export class MockTTSProvider implements TTSProvider {
  readonly name = "mock";
  async synthesize(text: string, opts: { speed?: number } = {}): Promise<TTSResult> {
    const chars = [...text.replace(/\s+/g, "")].length;
    const speed = opts.speed ?? 1;
    const durationMs = Math.max(800, Math.round((chars * 170 + 400) / speed));
    const n = Math.round((SAMPLE_RATE * durationMs) / 1000);
    const pcm = new Int16Array(n);
    const syllableMs = 170 / speed;
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const posInSyll = (t * 1000) % syllableMs;
      const env = posInSyll < syllableMs * 0.6 ? Math.sin((Math.PI * posInSyll) / (syllableMs * 0.6)) : 0;
      const idx = Math.floor((t * 1000) / syllableMs);
      const freq = 180 + ((idx * 37) % 90);
      pcm[i] = Math.round(Math.sin(2 * Math.PI * freq * t) * env * 0.12 * 32767);
    }
    return { audio: pcmToWav(pcm), mimeType: "audio/wav", durationMs, ext: "wav" };
  }
}
