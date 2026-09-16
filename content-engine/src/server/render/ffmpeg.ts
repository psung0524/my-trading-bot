import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("ffmpeg-static") as string | null;
  if (!p) throw new Error("ffmpeg 바이너리를 찾을 수 없습니다. FFMPEG_PATH를 설정하세요");
  return p;
}

export function runFfmpeg(args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath(), ["-hide_banner", "-y", ...args], { cwd: opts.cwd, stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 200_000) stderr = stderr.slice(-100_000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("ffmpeg 시간 초과"));
    }, opts.timeoutMs ?? 5 * 60_000);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stderr });
      else reject(new Error(`ffmpeg 실패 (code ${code}): ${stderr.split("\n").filter(Boolean).slice(-8).join("\n")}`));
    });
  });
}

/** 오디오 길이(ms)를 ffmpeg stderr의 time=에서 읽는다 (ffprobe 없이) */
export async function probeDurationMs(audio: Buffer, ext: string): Promise<number> {
  const dir = await mkdtemp(path.join(tmpdir(), "ce-probe-"));
  try {
    const f = path.join(dir, `a.${ext}`);
    await writeFile(f, audio);
    const { stderr } = await runFfmpeg(["-i", f, "-f", "null", "-"]);
    const matches = [...stderr.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
    const last = matches.at(-1);
    if (!last) return 0;
    return Math.round((Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3])) * 1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "ce-render-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export { readFile as readTempFile };
