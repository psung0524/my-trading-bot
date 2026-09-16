import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey, type StorageProvider } from "./types";

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  constructor(private root: string) {}
  private resolve(key: string) {
    assertSafeKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
    return { key, size: data.length };
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async exists(key: string) {
    return stat(this.resolve(key)).then(() => true).catch(() => false);
  }
  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
  url(key: string) {
    return `/api/files/${key}`;
  }
}
