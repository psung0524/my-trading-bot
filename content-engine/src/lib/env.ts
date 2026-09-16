import { z } from "zod";

/**
 * 서버 환경변수. 비밀정보는 여기서만 읽는다.
 * 클라이언트 번들에는 포함되지 않는다(server-only 파일에서만 import).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().min(16),
  APP_URL: z.string().url().default("http://localhost:3000"),
  JOB_RUNNER: z.enum(["inline", "worker"]).default("inline"),
  AI_PROVIDER: z.enum(["mock", "anthropic", "openai"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  TTS_PROVIDER: z.enum(["mock", "edge", "openai"]).default("mock"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  CHROMIUM_PATH: z.string().optional(),
  FFMPEG_PATH: z.string().optional(),
  THREADS_PUBLISHER: z.enum(["mock", "threads"]).default("mock"),
  THREADS_APP_ID: z.string().optional(),
  THREADS_APP_SECRET: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_GITHUB_ID: z.string().optional(),
  AUTH_GITHUB_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function emptyToUndefined(v: unknown) {
  return typeof v === "string" && v.trim() === "" ? undefined : v;
}

export function env(): Env {
  if (cached) return cached;
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, emptyToUndefined(v)]),
  );
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    throw new Error(`환경변수 설정 오류: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
