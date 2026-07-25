import type { Dictionary } from "@/lib/i18n";

const STYLES: Record<string, string> = {
  pending: "bg-warning-soft text-warning",
  confirmed: "bg-info-soft text-info",
  shipped: "bg-brand-100 text-brand-700",
  delivered: "bg-success-soft text-success",
  cancelled: "bg-ink-100 text-ink-500",
};

export function StatusBadge({ status, t }: { status: string; t: Dictionary }) {
  const label = t.status[status as keyof Dictionary["status"]] ?? status;

  return <span className={`badge ${STYLES[status] ?? "bg-ink-100 text-ink-500"}`}>{label}</span>;
}
