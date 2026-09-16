import type { ChannelType } from "@prisma/client";
import { blogBodySchema, instagramBodySchema, shortsBodySchema, threadsBodySchema } from "@/lib/schemas/content";

export type TextChunk = { location: string; text: string; requireAsOfDate: boolean };

/** 채널 본문에서 검사 대상 텍스트를 위치 정보와 함께 뽑는다 */
export function extractChannelTexts(channel: ChannelType, body: unknown): TextChunk[] {
  switch (channel) {
    case "THREADS": {
      const b = threadsBodySchema.parse(body);
      return [{ location: "text", text: b.text, requireAsOfDate: true }];
    }
    case "INSTAGRAM": {
      const b = instagramBodySchema.parse(body);
      const cards = b.cards.map((c, i) => ({
        location: `cards[${i}]`,
        text: [c.title, c.subtitle, c.body, c.label, c.value, ...c.items, ...c.rows.map((r) => `${r.label} ${r.value}`)].join("\n"),
        requireAsOfDate: false,
      }));
      return [...cards, { location: "caption", text: b.caption, requireAsOfDate: true }];
    }
    case "BLOG": {
      const b = blogBodySchema.parse(body);
      return [
        { location: "title", text: b.title, requireAsOfDate: false },
        { location: "metaDescription", text: b.metaDescription, requireAsOfDate: false },
        ...b.sections.map((s, i) => ({ location: `sections[${i}]`, text: `${s.heading}\n${s.markdown}`, requireAsOfDate: false })),
        ...b.faq.map((f, i) => ({ location: `faq[${i}]`, text: `${f.q}\n${f.a}`, requireAsOfDate: false })),
      ];
    }
    case "YOUTUBE_SHORTS": {
      const b = shortsBodySchema.parse(body);
      return [
        { location: "hook", text: b.hook, requireAsOfDate: false },
        ...b.scenes.map((s, i) => ({ location: `scenes[${i}]`, text: `${s.narration}\n${s.onScreenText}\n${s.subtitle}`, requireAsOfDate: false })),
        { location: "description", text: b.description, requireAsOfDate: true },
      ];
    }
  }
}
