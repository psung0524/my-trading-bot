"use client";

import { usePathname, useRouter } from "next/navigation";

export function ProductPicker({ products, selectedId }: { products: { id: string; name: string }[]; selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (products.length <= 1) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">제품</span>
      <select
        className="h-9 rounded-md border bg-background px-2"
        value={selectedId}
        onChange={(e) => router.push(`${pathname}?product=${e.target.value}`)}
      >
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
