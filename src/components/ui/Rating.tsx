import { StarIcon } from "@/components/ui/icons";

/**
 * Five stars with half-step precision. The partial star is done with a
 * clipped overlay so a 4.3 doesn't round up to a full star.
 */
export function Rating({
  value,
  count,
  size = 14,
  className = "",
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-flex" aria-hidden="true">
        <span className="inline-flex gap-0.5 text-ink-200">
          {[0, 1, 2, 3, 4].map((index) => (
            <StarIcon key={index} size={size} filled />
          ))}
        </span>
        <span
          className="absolute inset-0 inline-flex gap-0.5 overflow-hidden text-accent-400"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          {[0, 1, 2, 3, 4].map((index) => (
            <StarIcon key={index} size={size} filled className="shrink-0" />
          ))}
        </span>
      </span>

      <span className="text-xs font-semibold text-ink-600">{clamped.toFixed(1)}</span>
      {typeof count === "number" && <span className="text-xs text-ink-400">({count})</span>}
    </span>
  );
}
