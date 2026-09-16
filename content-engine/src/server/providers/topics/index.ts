import type { SourceType } from "@prisma/client";
import { z } from "zod";
import { topicCandidateSchema, type TopicCandidate } from "@/lib/schemas/content";
import { getAIProvider } from "@/server/providers/ai";
import { resolvePrompt } from "@/server/content/prompt-registry";

/**
 * TopicSourceProvider: 외부/내부 데이터에서 소재 후보를 발견한다.
 * MVP: TREND, FREQUENTLY_VIEWED, PRODUCT_DATA, EDUCATIONAL, COMMUNITY_QUESTION은 Mock 데이터(AI Mock)로 동작.
 */
export interface TopicSourceProvider {
  readonly sourceType: SourceType;
  discover(input: { product: { name: string; url: string; description: string; features: string[] }; existingTitles: string[]; workspaceId: string }): Promise<TopicCandidate[]>;
}

const candidatesSchema = z.object({ candidates: z.array(topicCandidateSchema).max(10) });

class AITopicSourceProvider implements TopicSourceProvider {
  constructor(public readonly sourceType: SourceType) {}
  async discover(input: Parameters<TopicSourceProvider["discover"]>[0]) {
    const prompt = await resolvePrompt("topic.discover", input.workspaceId);
    const res = await getAIProvider().generateStructured({
      promptKey: prompt.key,
      promptVersion: prompt.version,
      system: prompt.system,
      user: prompt.user,
      schema: candidatesSchema,
      schemaName: prompt.schemaName,
      context: { workspaceId: input.workspaceId, sourceType: this.sourceType, product: input.product, existingTitles: input.existingTitles },
    });
    return res.data.candidates.filter((c) => !input.existingTitles.includes(c.title));
  }
}

export const DISCOVERABLE_SOURCE_TYPES: SourceType[] = ["TREND", "FREQUENTLY_VIEWED", "PRODUCT_DATA", "EDUCATIONAL", "COMMUNITY_QUESTION"];

export function getTopicSourceProvider(sourceType: SourceType): TopicSourceProvider {
  return new AITopicSourceProvider(sourceType);
}
