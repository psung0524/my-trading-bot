import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { PageHeader } from "@/components/app/page-header";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "제품 등록" };

export default async function NewProductPage(props: PageProps<"/w/[slug]/products/new">) {
  const { slug } = await props.params;
  await requireWorkspacePage(slug, "manageBrand");
  return (
    <div className="max-w-xl">
      <PageHeader title="제품 등록" description="1단계: 제품 정보 → 2단계: 페이지 분석 → 3단계: 브랜드 프로필" />
      <ProductForm slug={slug} mode="create" />
    </div>
  );
}
