import { renderStatic as renderToStaticMarkup } from "../static-html";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import type { ShortsBody, ShortsScene } from "@/lib/schemas/content";
import { renderHtmlToPng } from "../image-renderer";
import { getTTSProvider } from "@/server/providers/tts";
import { concatWav, silenceWav, wavDurationMs } from "@/server/providers/tts/wav";
import { runFfmpeg, withTempDir } from "../ffmpeg";
import { SceneFrame, SHORTS_SIZE } from "./scene-frame";
import { renderThumbnail } from "../thumbnail";

export type ShortsRenderInput = {
  body: ShortsBody;
  brandName: string;
  colors: { primary: string; secondary: string; accent: string };
  bgmPath?: string;
  onStep?: (step: string, progress: number) => void;
};

export type ShortsRenderOutput = {
  mp4: Buffer;
  srt: string;
  thumbnail: Buffer;
  scenes: (ShortsScene & { audioMs: number })[];
  sceneImages: Buffer[];
  audio: Buffer;
  totalMs: number;
};

const MIN_SCENE_MS = 1500;
const GAP_MS = 250;

function fmtSrt(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const x = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`;
}

/** 자막을 2줄 이내로 나누기 위한 간단한 분할 */
export function splitSubtitle(text: string, maxLen = 22): string {
  if (text.length <= maxLen) return text;
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxLen && cur) {
      lines.push(cur.trim());
      cur = w;
    } else cur = `${cur} ${w}`;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 2).join("\n") + (lines.length > 2 ? "…" : "");
}

/**
 * 파이프라인: 대본 검증 → 장면 이미지 → TTS → 길이 분석 → 타이밍 조정 → 자막 → FFmpeg 합성 → 썸네일
 * 자막은 폰트 의존성을 없애기 위해 장면 이미지에 직접 렌더링하고, SRT도 별도로 만든다.
 */
export async function renderShorts(input: ShortsRenderInput): Promise<ShortsRenderOutput> {
  const { body, brandName, colors, onStep } = input;
  if (body.scenes.length < 2) throw new Error("장면이 2개 이상 필요합니다");
  const tts = getTTSProvider();

  // 1) TTS + 길이 분석
  onStep?.("음성 생성", 10);
  const audioParts: Buffer[] = [];
  const scenes: (ShortsScene & { audioMs: number })[] = [];
  for (const s of body.scenes) {
    const text = s.narration.trim() || s.onScreenText.trim() || "…";
    const r = await tts.synthesize(text, { voice: body.voice });
    let wav = r.audio;
    if (r.ext !== "wav") wav = await transcodeToWav(r.audio, r.ext);
    const ms = wavDurationMs(wav) || r.durationMs;
    audioParts.push(wav, silenceWav(GAP_MS));
    scenes.push({ ...s, audioMs: ms });
  }

  // 2) 타이밍 조정: 장면 길이 = max(음성+간격, 최소)
  onStep?.("타이밍 조정", 30);
  let t = 0;
  for (const s of scenes) {
    const dur = Math.max(MIN_SCENE_MS, s.audioMs + GAP_MS);
    s.startSec = Math.round(t) / 1000;
    s.endSec = Math.round(t + dur) / 1000;
    t += dur;
  }
  const totalMs = Math.round(t);
  // 오디오 트랙 길이를 장면 길이에 맞춤(장면이 최소 길이로 늘어난 경우 무음 추가)
  const audioChunks: Buffer[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const sceneMs = Math.round((s.endSec - s.startSec) * 1000);
    audioChunks.push(audioParts[i * 2]);
    audioChunks.push(silenceWav(Math.max(0, sceneMs - s.audioMs)));
  }
  const audio = concatWav(audioChunks);

  // 3) 자막(SRT)
  const srt = scenes.map((s, i) => `${i + 1}\n${fmtSrt(Math.round(s.startSec * 1000))} --> ${fmtSrt(Math.round(s.endSec * 1000))}\n${(s.subtitle || s.narration).trim()}\n`).join("\n");

  // 4) 장면 이미지 (자막 포함, Safe Area 적용)
  onStep?.("장면 렌더링", 45);
  const sceneImages: Buffer[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const html = renderToStaticMarkup(<SceneFrame scene={s} index={i} total={scenes.length} colors={colors} brandName={brandName} subtitle={splitSubtitle((s.subtitle || s.narration).trim())} />);
    sceneImages.push((await renderHtmlToPng(html, SHORTS_SIZE)).png);
    onStep?.("장면 렌더링", 45 + Math.round(((i + 1) / scenes.length) * 25));
  }

  // 5) FFmpeg 합성 (장면별 fade 전환, 1080x1920 30fps H.264/AAC)
  onStep?.("영상 합성", 75);
  const mp4 = await withTempDir(async (dir) => {
    const inputs: string[] = [];
    const filters: string[] = [];
    for (let i = 0; i < scenes.length; i++) {
      const f = path.join(dir, `scene-${i}.png`);
      await writeFile(f, sceneImages[i]);
      const dur = (scenes[i].endSec - scenes[i].startSec).toFixed(3);
      inputs.push("-loop", "1", "-framerate", "30", "-t", dur, "-i", f);
      const fade = Math.min(0.3, Number(dur) / 4).toFixed(2);
      filters.push(`[${i}:v]format=yuv420p,fade=t=in:st=0:d=${fade},fade=t=out:st=${(Number(dur) - Number(fade)).toFixed(3)}:d=${fade},setsar=1[v${i}]`);
    }
    const audioFile = path.join(dir, "voice.wav");
    await writeFile(audioFile, audio);
    inputs.push("-i", audioFile);
    const audioIdx = scenes.length;
    let audioMap = `${audioIdx}:a`;
    if (input.bgmPath) {
      inputs.push("-stream_loop", "-1", "-i", input.bgmPath);
      filters.push(`[${audioIdx + 1}:a]volume=0.12[bgm]`, `[${audioIdx}:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`);
      audioMap = "[aout]";
    }
    filters.push(`${scenes.map((_, i) => `[v${i}]`).join("")}concat=n=${scenes.length}:v=1:a=0[vout]`);
    const out = path.join(dir, "out.mp4");
    await runFfmpeg([
      ...inputs,
      "-filter_complex", filters.join(";"),
      "-map", "[vout]", "-map", audioMap,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-r", "30", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
      "-t", (totalMs / 1000).toFixed(3), "-movflags", "+faststart",
      out,
    ]);
    return readFile(out);
  });

  // 6) 썸네일
  onStep?.("썸네일", 95);
  const thumbnail = await renderThumbnail(body.thumbnailText || scenes[0].onScreenText, brandName, colors, SHORTS_SIZE, body.cta);
  onStep?.("완료", 100);
  return { mp4, srt, thumbnail, scenes, sceneImages, audio, totalMs };
}

async function transcodeToWav(audio: Buffer, ext: string): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const inp = path.join(dir, `in.${ext}`);
    const out = path.join(dir, "out.wav");
    await writeFile(inp, audio);
    await runFfmpeg(["-i", inp, "-ar", "24000", "-ac", "1", "-c:a", "pcm_s16le", out]);
    return readFile(out);
  });
}
