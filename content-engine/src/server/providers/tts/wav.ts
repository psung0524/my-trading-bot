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

export function wavDurationMs(wav: Buffer): number {
  if (wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF") return 0;
  const sampleRate = wav.readUInt32LE(24);
  const channels = wav.readUInt16LE(22);
  const bits = wav.readUInt16LE(34);
  const dataBytes = wav.readUInt32LE(40);
  return Math.round((dataBytes / (sampleRate * channels * (bits / 8))) * 1000);
}

export function wavPcm(wav: Buffer): Int16Array {
  const dataBytes = wav.readUInt32LE(40);
  const out = new Int16Array(dataBytes / 2);
  for (let i = 0; i < out.length; i++) out[i] = wav.readInt16LE(44 + i * 2);
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
