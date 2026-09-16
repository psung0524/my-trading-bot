-- CreateTable
CREATE TABLE "ReferencePost" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "productId" TEXT,
    "channel" "ChannelType" NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'PASTE',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ReferencePost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReferencePost_workspaceId_channel_idx" ON "ReferencePost"("workspaceId", "channel");

-- AddForeignKey
ALTER TABLE "ReferencePost" ADD CONSTRAINT "ReferencePost_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
