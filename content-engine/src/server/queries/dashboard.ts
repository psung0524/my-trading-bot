import { prisma } from "@/server/db/prisma";

export type NextAction = { title: string; description: string; href: string };

export async function getDashboardSummary(workspaceId: string, slug: string) {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    products,
    topicCounts,
    needsReview,
    rendering,
    scheduledToday,
    publishedToday,
    doneToday,
    clicks7d,
    signups7d,
    recommendations,
    failedJobs,
  ] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, deletedAt: null }, include: { brandProfile: { select: { tone: true, forbiddenPhrases: true } } } }),
    prisma.contentTopic.groupBy({ by: ["status"], where: { workspaceId, deletedAt: null }, _count: true }),
    prisma.channelContent.count({ where: { workspaceId, deletedAt: null, status: "NEEDS_REVIEW" } }),
    prisma.renderJob.count({ where: { workspaceId, status: { in: ["QUEUED", "PROCESSING"] } } }),
    prisma.channelContent.count({ where: { workspaceId, deletedAt: null, status: "SCHEDULED", scheduledAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.channelContent.count({ where: { workspaceId, deletedAt: null, status: "PUBLISHED", publishedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.auditLog.count({ where: { workspaceId, createdAt: { gte: dayStart }, action: { in: ["content.generate", "content.approve", "content.publish", "render.succeeded", "master.create"] } } }),
    prisma.analyticsEvent.count({ where: { workspaceId, eventName: "content_click", timestamp: { gte: weekAgo } } }),
    prisma.analyticsEvent.count({ where: { workspaceId, eventName: "signup_completed", timestamp: { gte: weekAgo } } }),
    prisma.recommendation.findMany({ where: { workspaceId, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.renderJob.count({ where: { workspaceId, status: "FAILED" } }),
  ]);

  const topics = Object.fromEntries(topicCounts.map((t) => [t.status, t._count])) as Record<string, number>;
  const nextActions: NextAction[] = [];
  const product = products[0];
  if (!product) {
    nextActions.push({ title: "제품 등록", description: "콘텐츠의 대상이 될 서비스 URL을 등록하세요.", href: `/w/${slug}/products/new` });
  } else {
    if (!product.analyzedAt) nextActions.push({ title: "제품 페이지 분석", description: `${product.name}의 기능과 키워드를 추출하세요.`, href: `/w/${slug}/products/${product.id}` });
    if (!product.brandProfile?.tone) nextActions.push({ title: "브랜드 프로필 설정", description: "말투와 금지 표현을 확인하세요.", href: `/w/${slug}/brand` });
    if ((topics.CANDIDATE ?? 0) + (topics.SELECTED ?? 0) === 0) nextActions.push({ title: "콘텐츠 소재 만들기", description: "질문, 계산, 기능 업데이트에서 소재를 만드세요.", href: `/w/${slug}/topics` });
    if ((topics.SELECTED ?? 0) > 0) nextActions.push({ title: "선택한 소재로 콘텐츠 생성", description: `${topics.SELECTED}개 소재가 생성을 기다립니다.`, href: `/w/${slug}/topics` });
    if (needsReview > 0) nextActions.push({ title: "콘텐츠 검토", description: `${needsReview}건이 승인을 기다립니다.`, href: `/w/${slug}/inbox` });
    if (failedJobs > 0) nextActions.push({ title: "실패한 렌더링 확인", description: `${failedJobs}건의 렌더링이 실패했습니다.`, href: `/w/${slug}/renders` });
  }

  return {
    hasProduct: Boolean(product),
    counts: { doneToday, needsReview, rendering, scheduledToday, publishedToday, clicks7d, signups7d, failedJobs },
    recommendations,
    nextActions,
  };
}
