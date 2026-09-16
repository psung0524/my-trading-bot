import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { resolveProduct, getProduct } from "@/server/queries/products";
import { brandProfileSchema } from "@/lib/schemas/product";
import { PageHeader } from "@/components/app/page-header";
import { ProductPicker } from "@/components/app/product-picker";
import { Button } from "@/components/ui/button";
import { BrandProfileForm } from "./brand-form";
import { BrandRules } from "./brand-rules";
import { LogoUpload } from "./logo-upload";
import { prisma } from "@/server/db/prisma";
import { getStorage } from "@/server/providers/storage";

export const metadata: Metadata = { title: "브랜드 프로필" };

export default async function BrandPage(props: PageProps<"/w/[slug]/brand">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const { products, selected } = await resolveProduct(ctx.workspace.id, typeof sp.product === "string" ? sp.product : undefined);

  if (!selected) {
    return (
      <div>
        <PageHeader title="브랜드 프로필" />
        <p className="text-sm text-muted-foreground">
          먼저 제품을 등록하세요.{" "}
          <Button asChild variant="link" className="px-1">
            <Link href={`/w/${slug}/products/new`}>제품 등록</Link>
          </Button>
        </p>
      </div>
    );
  }
  const product = await getProduct(ctx.workspace.id, selected.id);
  const bp = product?.brandProfile;
  const logo = bp?.logoAssetId ? await prisma.creativeAsset.findFirst({ where: { id: bp.logoAssetId, workspaceId: ctx.workspace.id, deletedAt: null } }) : null;
  const defaults = brandProfileSchema.parse({
    brandName: bp?.brandName ?? product?.name ?? "",
    tagline: bp?.tagline,
    operatorIdentity: bp?.operatorIdentity,
    targetAudience: bp?.targetAudience,
    contentGoal: bp?.contentGoal,
    tone: bp?.tone,
    preferredPhrases: bp?.preferredPhrases,
    forbiddenPhrases: bp?.forbiddenPhrases,
    ctas: bp?.ctas ?? [],
    primaryColor: bp?.primaryColor,
    secondaryColor: bp?.secondaryColor,
    accentColor: bp?.accentColor,
    fontFamily: bp?.fontFamily,
    financeDisclaimer: bp?.financeDisclaimer,
  });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="브랜드 프로필"
        description="말투, 금지 표현, CTA, 색상은 모든 채널 콘텐츠 생성에 사용됩니다."
        actions={<ProductPicker products={products.map((p) => ({ id: p.id, name: p.name }))} selectedId={selected.id} />}
      />
      <BrandProfileForm slug={slug} productId={selected.id} defaults={defaults} productUrl={selected.url} />
      <LogoUpload slug={slug} productId={selected.id} currentUrl={logo ? getStorage().url(logo.storageKey) : null} />
      <BrandRules
        slug={slug}
        productId={selected.id}
        rules={(bp?.rules ?? []).map((r) => ({ id: r.id, kind: r.kind, value: r.value, note: r.note, enabled: r.enabled }))}
      />
    </div>
  );
}
