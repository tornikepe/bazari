"use client";

import { formatPrice } from "@/lib/format";
import { useI18n } from "@/components/providers/I18nProvider";

/**
 * Price with an optional struck-through original. Formatting follows the
 * active locale (`1 250 ₾` vs `₾1,250.00`).
 */
export function Price({
  value,
  oldValue,
  size = "md",
  className = "",
}: {
  value: number;
  oldValue?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const { locale } = useI18n();

  const currentSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-xl",
    xl: "text-3xl",
  }[size];

  const oldSize = {
    sm: "text-xs",
    md: "text-xs",
    lg: "text-sm",
    xl: "text-base",
  }[size];

  const showOld = typeof oldValue === "number" && oldValue > value;

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`font-bold tracking-tight text-ink-900 ${currentSize}`}>
        {formatPrice(value, locale)}
      </span>
      {showOld && (
        <span className={`font-medium text-ink-400 line-through ${oldSize}`}>
          {formatPrice(oldValue, locale)}
        </span>
      )}
    </span>
  );
}
