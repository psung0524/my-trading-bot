import type { Card } from "@/lib/schemas/content";

/** 글자 수 기준 사전 경고 (클라이언트/서버 공용) */
export const CARD_LIMITS = { title: 22, subtitle: 40, body: 70, item: 36, value: 16 } as const;

export function cardTextWarnings(card: Card): string[] {
  const w: string[] = [];
  if (card.title.length > CARD_LIMITS.title) w.push(`제목이 ${CARD_LIMITS.title}자를 넘습니다 (${card.title.length}자)`);
  if (card.subtitle.length > CARD_LIMITS.subtitle) w.push(`부제가 ${CARD_LIMITS.subtitle}자를 넘습니다`);
  if (card.body.length > CARD_LIMITS.body) w.push(`본문이 ${CARD_LIMITS.body}자를 넘습니다`);
  if (card.value.length > CARD_LIMITS.value) w.push(`강조 값이 ${CARD_LIMITS.value}자를 넘습니다`);
  card.items.forEach((it, i) => {
    if (it.length > CARD_LIMITS.item) w.push(`항목 ${i + 1}이 ${CARD_LIMITS.item}자를 넘습니다`);
  });
  if (card.items.length > 6) w.push("항목이 6개를 넘어 잘릴 수 있습니다");
  return w;
}
