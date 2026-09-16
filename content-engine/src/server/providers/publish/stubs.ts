import type { ChannelType } from "@prisma/client";
import { PublishError, type PublisherProvider, type PublishInput, type PublishResult } from "./types";

/**
 * 인터페이스만 제공되는 Provider. 계정이 연결되면(향후 구현) 승인 후 게시 가능한 구조.
 * MVP에서는 Instagram(다운로드), 블로그(내보내기/WordPress 인터페이스), YouTube(Mock 업로드)만 지원.
 */
abstract class NotYetImplementedPublisher implements PublisherProvider {
  abstract readonly channel: ChannelType;
  abstract readonly name: string;
  isConfigured(account: PublishInput["account"]) {
    return Boolean(account?.accessToken && account.provider === this.name);
  }
  async publish(): Promise<PublishResult> {
    throw new PublishError(`${this.name} 실제 게시는 아직 지원하지 않습니다. 결과물을 다운로드해 직접 게시하세요`, false);
  }
}

export class InstagramPublisher extends NotYetImplementedPublisher {
  readonly channel = "INSTAGRAM" as const;
  readonly name = "instagram";
}

/** WordPress REST API Provider 인터페이스 (application password 기반). 계정 config: { siteUrl, username } + accessToken=app password */
export class WordPressPublisher implements PublisherProvider {
  readonly channel = "BLOG" as const;
  readonly name = "wordpress";
  isConfigured(account: PublishInput["account"]) {
    return Boolean(account?.accessToken && account.provider === "wordpress" && account.config?.siteUrl && account.config?.username);
  }
  async publish(input: PublishInput): Promise<PublishResult> {
    const acct = input.account;
    if (!this.isConfigured(acct) || !acct) throw new PublishError("WordPress 계정이 연결되지 않았습니다", false);
    const { blogBodySchema } = await import("@/lib/schemas/content");
    const { blogToMarkdown } = await import("@/components/channels/blog-preview");
    const { renderMarkdown } = await import("@/lib/markdown");
    const body = blogBodySchema.parse(input.body);
    const html = renderMarkdown(blogToMarkdown(body));
    const site = String(acct.config.siteUrl).replace(/\/$/, "");
    const auth = Buffer.from(`${acct.config.username}:${acct.accessToken}`).toString("base64");
    input.log(`WordPress 초안 생성: ${site}`);
    const res = await fetch(`${site}/wp-json/wp/v2/posts`, { method: "POST", headers: { authorization: `Basic ${auth}`, "content-type": "application/json" }, body: JSON.stringify({ title: body.title, content: html, excerpt: body.metaDescription, status: (acct.config.status as string) || "draft" }) });
    const j = (await res.json()) as { id?: number; link?: string; message?: string };
    if (!res.ok || !j.id) throw new PublishError(`WordPress 게시 실패: ${j.message ?? res.status}`, res.status >= 500);
    return { externalId: String(j.id), externalUrl: j.link ?? site, raw: j };
  }
}

export class YouTubePublisher extends NotYetImplementedPublisher {
  readonly channel = "YOUTUBE_SHORTS" as const;
  readonly name = "youtube";
}
