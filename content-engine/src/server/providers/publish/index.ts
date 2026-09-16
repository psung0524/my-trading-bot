import type { ChannelType } from "@prisma/client";
import { MockPublisher } from "./mock";
import { ThreadsPublisher } from "./threads";
import { InstagramPublisher, WordPressPublisher, YouTubePublisher } from "./stubs";
import type { PublisherProvider } from "./types";

export type { PublisherProvider, PublishInput, PublishResult } from "./types";
export { PublishError } from "./types";

/**
 * 계정 provider에 따라 Publisher를 고른다. 계정이 없거나 provider가 mock이면 MockPublisher.
 * THREADS_PUBLISHER=threads + 실제 계정이면 ThreadsPublisher.
 */
export function getPublisher(channel: ChannelType, accountProvider: string | null | undefined): PublisherProvider {
  if (!accountProvider || accountProvider === "mock") return new MockPublisher(channel);
  switch (channel) {
    case "THREADS":
      return accountProvider === "threads" ? new ThreadsPublisher() : new MockPublisher(channel);
    case "INSTAGRAM":
      return accountProvider === "instagram" ? new InstagramPublisher() : new MockPublisher(channel);
    case "BLOG":
      return accountProvider === "wordpress" ? new WordPressPublisher() : new MockPublisher(channel);
    case "YOUTUBE_SHORTS":
      return accountProvider === "youtube" ? new YouTubePublisher() : new MockPublisher(channel);
  }
}
