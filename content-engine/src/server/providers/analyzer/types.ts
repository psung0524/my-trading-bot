import type { ProductAnalysis } from "@/lib/schemas/product";

export interface ProductAnalyzer {
  analyze(url: string): Promise<ProductAnalysis>;
}
