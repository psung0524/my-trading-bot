/** 16-bit PCM WAV 유틸 */
export const SAMPLE_RATE = 24000;

export function pcmToWav(pcm: Int16Array, sampleRate = SAMPLE_RATE): Buffer {
  const dataBytes = pcm.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < pcm.length; i++) buf.writeInt16LE(pcm[i], 44 + i * 2);
  return buf;
}

/** RIFF 청크를 순회해 fmt/data 위치를 찾는다 (ffmpeg가 넣는 LIST 청크 등 대응) */
export function parseWav(wav: Buffer): { sampleRate: number; channels: number; bits: number; dataOffset: number; dataBytes: number } {
  if (wav.length < 12 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") throw new Error("WAV 형식이 아닙니다");
  let pos = 12;
  let fmt: { sampleRate: number; channels: number; bits: number } | null = null;
  while (pos + 8 <= wav.length) {
    const id = wav.toString("ascii", pos, pos + 4);
    const size = wav.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") fmt = { channels: wav.readUInt16LE(body + 2), sampleRate: wav.readUInt32LE(body + 4), bits: wav.readUInt16LE(body + 14) };
    if (id === "data") {
      if (!fmt) throw new Error("WAV fmt 청크가 없습니다");
      return { ...fmt, dataOffset: body, dataBytes: Math.min(size, wav.length - body) };
    }
    pos = body + size + (size % 2);
  }
  throw new Error("WAV data 청크가 없습니다");
}

export function wavDurationMs(wav: Buffer): number {
  try {
    const p = parseWav(wav);
    return Math.round((p.dataBytes / (p.sampleRate * p.channels * (p.bits / 8))) * 1000);
  } catch {
    return 0;
  }
}

export function wavPcm(wav: Buffer): Int16Array {
  const p = parseWav(wav);
  if (p.bits !== 16 || p.channels !== 1) throw new Error(`지원하지 않는 WAV (${p.bits}bit, ${p.channels}ch). 16bit mono 필요`);
  const out = new Int16Array(Math.floor(p.dataBytes / 2));
  for (let i = 0; i < out.length; i++) out[i] = wav.readInt16LE(p.dataOffset + i * 2);
  return out;
}

export function concatWav(wavs: Buffer[], sampleRate = SAMPLE_RATE): Buffer {
  const parts = wavs.map(wavPcm);
  const total = parts.reduce((s, p) => s + p.length, 0);
  const pcm = new Int16Array(total);
  let off = 0;
  for (const p of parts) {
    pcm.set(p, off);
    off += p.length;
  }
  return pcmToWav(pcm, sampleRate);
}

export function silenceWav(ms: number, sampleRate = SAMPLE_RATE): Buffer {
  return pcmToWav(new Int16Array(Math.round((sampleRate * ms) / 1000)), sampleRate);
}
