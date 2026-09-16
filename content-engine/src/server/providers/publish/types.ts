import type { ChannelType } from "@prisma/client";

export type PublishInput = {
  workspaceId: string;
  channelContentId: string;
  channel: ChannelType;
  /** 채널별 본문(스키마는 channelBodySchemas) */
  body: unknown;
  /** 렌더링된 자산 (PNG/MP4 등) 다운로드용 */
  assets: { kind: string; url: string; key: string; data: () => Promise<Buffer> }[];
  /** 멱등키: 같은 키로 두 번 게시되지 않는다 */
  idempotencyKey: string;
  account: { id: string; provider: string; externalId: string | null; accessToken: string | null; config: Record<string, unknown> } | null;
  log: (msg: string) => void;
};

export type PublishResult = { externalId: string; externalUrl: string; raw?: unknown };

export interface PublisherProvider {
  readonly channel: ChannelType;
  readonly name: string;
  /** 실제 API 연결 여부. false면 내보내기만 가능 */
  isConfigured(account: PublishInput["account"]): boolean;
  publish(input: PublishInput): Promise<PublishResult>;
}

export class PublishError extends Error {
  constructor(message: string, public readonly retryable = true) {
    super(message);
    this.name = "PublishError";
  }
}
