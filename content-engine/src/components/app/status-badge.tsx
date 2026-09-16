import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_VARIANT } from "@/lib/labels";

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{STATUS_LABELS[status] ?? status}</Badge>;
}
