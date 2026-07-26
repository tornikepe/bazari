import { AlertIcon } from "@/components/ui/icons";

/**
 * Shows the one-time code on screen.
 *
 * This exists only because the demo has no mail provider wired up. It is
 * deliberately loud about that: in production the code would be emailed and
 * never returned to the browser at all.
 */
export function DemoCodeNotice({ code, label }: { code?: string; label: string }) {
  if (!code) return null;

  return (
    <p className="flex items-center gap-2 rounded-control bg-warning-soft p-3 text-xs text-warning">
      <AlertIcon size={15} className="shrink-0" />
      <span>
        {label}{" "}
        <strong className="font-mono text-sm tracking-widest">{code}</strong>
      </span>
    </p>
  );
}
