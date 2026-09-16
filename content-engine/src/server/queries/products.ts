import { prisma } from "@/server/db/prisma";

export async function listProducts(workspaceId: string) {
  return prisma.product.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    include: { brandProfile: { select: { id: true, brandName: true } } },
  });
}

export async function getProduct(workspaceId: string, productId: string) {
  return prisma.product.findFirst({
    where: { id: productId, workspaceId, deletedAt: null },
    include: { brandProfile: { include: { rules: { orderBy: { createdAt: "asc" } } } } },
  });
}

/** ?product= 파라미터 또는 첫 제품 */
export async function resolveProduct(workspaceId: string, preferredId?: string) {
  const products = await listProducts(workspaceId);
  const selected = products.find((p) => p.id === preferredId) ?? products[0] ?? null;
  return { products, selected };
}
