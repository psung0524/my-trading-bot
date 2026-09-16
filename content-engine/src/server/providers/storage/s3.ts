import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { assertSafeKey, type StorageProvider } from "./types";

/** S3 호환(AWS S3, MinIO, R2 등) 스토리지 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private client: S3Client;
  constructor(private bucket: string, opts: { region?: string; endpoint?: string; accessKeyId?: string; secretAccessKey?: string }) {
    this.client = new S3Client({
      region: opts.region ?? "ap-northeast-2",
      endpoint: opts.endpoint || undefined,
      forcePathStyle: Boolean(opts.endpoint),
      credentials: opts.accessKeyId && opts.secretAccessKey ? { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } : undefined,
    });
  }
  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: data, ContentType: contentType }));
    return { key, size: data.length };
  }
  async get(key: string) {
    assertSafeKey(key);
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("객체를 읽을 수 없습니다");
    return Buffer.from(bytes);
  }
  async exists(key: string) {
    assertSafeKey(key);
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
  url(key: string) {
    return `/api/files/${key}`;
  }
}
