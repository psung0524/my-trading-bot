import { describe, expect, it } from "vitest";
import { concatWav, parseWav, pcmToWav, wavDurationMs, wavPcm } from "@/server/providers/tts/wav";

function withListChunk(wav: Buffer): Buffer {
  // ffmpeg처럼 fmt 뒤에 LIST 청크를 끼워 넣는다
  const list = Buffer.alloc(8 + 26);
  list.write("LIST", 0);
  list.writeUInt32LE(26, 4);
  list.write("INFOISFT", 8);
  list.writeUInt32LE(14, 16);
  list.write("Lavf61.7.100\0\0", 20);
  const head = wav.subarray(0, 36);
  const rest = wav.subarray(36);
  const out = Buffer.concat([head, list, rest]);
  out.writeUInt32LE(out.length - 8, 4);
  return out;
}

describe("wav", () => {
  it("LIST 청크가 있어도 data를 찾는다", () => {
    const pcm = new Int16Array(24000).map((_, i) => Math.round(Math.sin(i / 10) * 10000));
    const plain = pcmToWav(pcm);
    const withList = withListChunk(plain);
    expect(wavDurationMs(plain)).toBe(1000);
    expect(wavDurationMs(withList)).toBe(1000);
    expect(parseWav(withList).dataBytes).toBe(48000);
    const back = wavPcm(withList);
    expect(back.length).toBe(24000);
    expect(back[100]).toBe(pcm[100]);
    expect(wavDurationMs(concatWav([withList, plain]))).toBe(2000);
  });
});
