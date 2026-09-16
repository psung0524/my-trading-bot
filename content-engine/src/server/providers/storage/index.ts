import path from "node:path";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";
import type { StorageProvider } from "./types";

export type { StorageProvider } from "./types";
export { workspaceOfKey, assertSafeKey } from "./types";

const g = globalThis as unknown as { storage?: StorageProvider };

export function getStorage(): StorageProvider {
  if (g.storage) return g.storage;
  if (process.env.STORAGE_PROVIDER === "s3" && process.env.S3_BUCKET) {
    g.storage = new S3StorageProvider(process.env.S3_BUCKET, {
      region: process.env.S3_REGION,
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    });
  } else {
    g.storage = new LocalStorageProvider(path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || "./storage"));
  }
  return g.storage;
}

export function mimeOf(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  return (
    { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", wav: "audio/wav", mp3: "audio/mpeg", srt: "text/plain; charset=utf-8", zip: "application/zip", md: "text/markdown; charset=utf-8", html: "text/html; charset=utf-8", json: "application/json", txt: "text/plain; charset=utf-8" }[ext ?? ""] ?? "application/octet-stream"
  );
}
