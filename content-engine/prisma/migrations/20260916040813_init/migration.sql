-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('THREADS', 'INSTAGRAM', 'BLOG', 'YOUTUBE_SHORTS');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PRODUCT_DATA', 'MANUAL_INPUT', 'USER_QUESTION', 'TREND', 'FREQUENTLY_VIEWED', 'CALCULATION', 'FEATURE_UPDATE', 'EDUCATIONAL', 'COMMUNITY_QUESTION');

-- CreateEnum
CREATE TYPE "ContentCategory" AS ENUM ('INFORMATIONAL', 'DATA', 'ENGAGEMENT', 'BRANDING', 'PROMOTION');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('IDEA', 'GENERATING', 'DRAFT', 'NEEDS_REVIEW', 'NEEDS_SOURCE', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('CANDIDATE', 'SELECTED', 'IN_PROGRESS', 'DONE', 'DISMISSED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('CARD_PNG', 'CARD_ZIP', 'BLOG_THUMBNAIL', 'SCENE_PNG', 'TTS_AUDIO', 'SUBTITLE', 'VIDEO_MP4', 'VIDEO_THUMBNAIL', 'LOGO', 'OTHER');

-- CreateEnum
CREATE TYPE "BrandRuleKind" AS ENUM ('FORBIDDEN_PHRASE', 'PREFERRED_PHRASE', 'TONE', 'DISCLAIMER', 'CTA', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LearningStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DELETED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "analysis" JSONB NOT NULL DEFAULT '{}',
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "operatorIdentity" TEXT NOT NULL DEFAULT '',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "contentGoal" TEXT NOT NULL DEFAULT '',
    "tone" TEXT NOT NULL DEFAULT '',
    "preferredPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "forbiddenPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ctas" JSONB NOT NULL DEFAULT '[]',
    "primaryColor" TEXT NOT NULL DEFAULT '#0F766E',
    "secondaryColor" TEXT NOT NULL DEFAULT '#F0FDFA',
    "accentColor" TEXT NOT NULL DEFAULT '#F59E0B',
    "fontFamily" TEXT NOT NULL DEFAULT 'Pretendard',
    "logoAssetId" TEXT,
    "financeDisclaimer" TEXT NOT NULL DEFAULT '',
    "channelSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandRule" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "kind" "BrandRuleKind" NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandLearning" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT,
    "channel" "ChannelType",
    "pattern" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "status" "LearningStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandLearning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentTopic" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coreQuestion" TEXT NOT NULL DEFAULT '',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "purpose" TEXT NOT NULL DEFAULT '',
    "category" "ContentCategory" NOT NULL DEFAULT 'INFORMATIONAL',
    "expectedChannels" "ChannelType"[] DEFAULT ARRAY[]::"ChannelType"[],
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "asOfDate" TIMESTAMP(3),
    "sources" JSONB NOT NULL DEFAULT '[]',
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "cta" JSONB,
    "duplicateScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "similarContentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expectedTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "TopicStatus" NOT NULL DEFAULT 'CANDIDATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentMaster" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "facts" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "cautions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta" JSONB,
    "validation" JSONB NOT NULL DEFAULT '{}',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ContentMaster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalId" TEXT,
    "accessTokenEnc" TEXT,
    "refreshTokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config" JSONB NOT NULL DEFAULT '{}',
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelContent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL DEFAULT '',
    "body" JSONB NOT NULL DEFAULT '{}',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalId" TEXT,
    "externalUrl" TEXT,
    "validation" JSONB NOT NULL DEFAULT '{}',
    "options" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "editedById" TEXT,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAsset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT,
    "kind" "AssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CreativeAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignItem" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampaignItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "contentVersion" INTEGER NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "channelAccountId" TEXT,
    "channel" "ChannelType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "lastError" TEXT,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "step" TEXT NOT NULL DEFAULT '',
    "lastError" TEXT,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "resultAssetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingLink" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT,
    "campaignId" TEXT,
    "code" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "utmSource" TEXT NOT NULL,
    "utmMedium" TEXT NOT NULL,
    "utmCampaign" TEXT NOT NULL,
    "utmContent" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "campaignId" TEXT,
    "channelContentId" TEXT,
    "trackingLinkId" TEXT,
    "anonymousId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL,
    "landingPage" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPerformance" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelContentId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "impressions" INTEGER,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "landingVisits" INTEGER NOT NULL DEFAULT 0,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "activations" INTEGER NOT NULL DEFAULT 0,
    "returnVisits" INTEGER NOT NULL DEFAULT 0,
    "paidConversions" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "system" TEXT NOT NULL,
    "user" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "result" JSONB,
    "logs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Product_workspaceId_idx" ON "Product"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_productId_key" ON "BrandProfile"("productId");

-- CreateIndex
CREATE INDEX "BrandRule_brandProfileId_idx" ON "BrandRule"("brandProfileId");

-- CreateIndex
CREATE INDEX "BrandLearning_workspaceId_status_idx" ON "BrandLearning"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "DataSource_productId_idx" ON "DataSource"("productId");

-- CreateIndex
CREATE INDEX "ContentTopic_workspaceId_status_idx" ON "ContentTopic"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ContentTopic_productId_idx" ON "ContentTopic"("productId");

-- CreateIndex
CREATE INDEX "ContentSource_topicId_idx" ON "ContentSource"("topicId");

-- CreateIndex
CREATE INDEX "ContentMaster_workspaceId_status_idx" ON "ContentMaster"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ChannelAccount_workspaceId_channel_idx" ON "ChannelAccount"("workspaceId", "channel");

-- CreateIndex
CREATE INDEX "ChannelContent_workspaceId_status_idx" ON "ChannelContent"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "ChannelContent_masterId_idx" ON "ChannelContent"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_channelContentId_version_key" ON "ContentVersion"("channelContentId", "version");

-- CreateIndex
CREATE INDEX "CreativeAsset_workspaceId_idx" ON "CreativeAsset"("workspaceId");

-- CreateIndex
CREATE INDEX "CreativeAsset_channelContentId_idx" ON "CreativeAsset"("channelContentId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_workspaceId_slug_key" ON "Campaign"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignItem_campaignId_channelContentId_key" ON "CampaignItem"("campaignId", "channelContentId");

-- CreateIndex
CREATE INDEX "Approval_channelContentId_idx" ON "Approval"("channelContentId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishJob_idempotencyKey_key" ON "PublishJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PublishJob_workspaceId_status_idx" ON "PublishJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "PublishJob_channelContentId_idx" ON "PublishJob"("channelContentId");

-- CreateIndex
CREATE UNIQUE INDEX "RenderJob_idempotencyKey_key" ON "RenderJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RenderJob_workspaceId_status_idx" ON "RenderJob"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "RenderJob_channelContentId_idx" ON "RenderJob"("channelContentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_code_key" ON "TrackingLink"("code");

-- CreateIndex
CREATE INDEX "TrackingLink_workspaceId_idx" ON "TrackingLink"("workspaceId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_workspaceId_eventName_timestamp_idx" ON "AnalyticsEvent"("workspaceId", "eventName", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_workspaceId_channelContentId_idx" ON "AnalyticsEvent"("workspaceId", "channelContentId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_workspaceId_anonymousId_idx" ON "AnalyticsEvent"("workspaceId", "anonymousId");

-- CreateIndex
CREATE INDEX "ContentPerformance_workspaceId_date_idx" ON "ContentPerformance"("workspaceId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPerformance_channelContentId_date_key" ON "ContentPerformance"("channelContentId", "date");

-- CreateIndex
CREATE INDEX "Recommendation_workspaceId_status_idx" ON "Recommendation"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_workspaceId_key_key" ON "PromptTemplate"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "PromptVersion_templateId_version_key" ON "PromptVersion"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Job_workspaceId_idx" ON "Job"("workspaceId");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandRule" ADD CONSTRAINT "BrandRule_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "BrandProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrandLearning" ADD CONSTRAINT "BrandLearning_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTopic" ADD CONSTRAINT "ContentTopic_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentTopic" ADD CONSTRAINT "ContentTopic_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ContentTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMaster" ADD CONSTRAINT "ContentMaster_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMaster" ADD CONSTRAINT "ContentMaster_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentMaster" ADD CONSTRAINT "ContentMaster_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "ContentTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelAccount" ADD CONSTRAINT "ChannelAccount_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelContent" ADD CONSTRAINT "ChannelContent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelContent" ADD CONSTRAINT "ChannelContent_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "ContentMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentVersion" ADD CONSTRAINT "ContentVersion_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAsset" ADD CONSTRAINT "CreativeAsset_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignItem" ADD CONSTRAINT "CampaignItem_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_channelAccountId_fkey" FOREIGN KEY ("channelAccountId") REFERENCES "ChannelAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderJob" ADD CONSTRAINT "RenderJob_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_trackingLinkId_fkey" FOREIGN KEY ("trackingLinkId") REFERENCES "TrackingLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPerformance" ADD CONSTRAINT "ContentPerformance_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentPerformance" ADD CONSTRAINT "ContentPerformance_channelContentId_fkey" FOREIGN KEY ("channelContentId") REFERENCES "ChannelContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptTemplate" ADD CONSTRAINT "PromptTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PromptTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
