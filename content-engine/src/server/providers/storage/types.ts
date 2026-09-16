export interface StorageProvider {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<{ key: string; size: number }>;
  get(key: string): Promise<Buffer>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  /** 앱 내 서빙 URL (권한 검사를 거치는 /api/files/...) */
  url(key: string): string;
}

/** 키 규칙: ws/{workspaceId}/{kind}/{id}/{filename}. 경로 탈출 방지 */
export function assertSafeKey(key: string) {
  if (!/^[a-zA-Z0-9_\-./]+$/.test(key) || key.includes("..") || key.startsWith("/")) throw new Error(`잘못된 스토리지 키: ${key}`);
}

export function workspaceOfKey(key: string): string | null {
  const m = key.match(/^ws\/([a-zA-Z0-9_-]+)\//);
  return m ? m[1] : null;
}
