"use client";

import { useI18n } from "@/components/providers/I18nProvider";
import { ChevronDownIcon } from "@/components/ui/icons";

/** The most a card offers in one go. Past ten, the cart page is the place. */
const MOST = 10;

/**
 * "How many" as a native `<select>`, sized to sit beside a button.
 *
 * A stepper is three controls; on a card that is twice the room there is.
 * A native select is one control, opens as a wheel on a phone and a list on
 * a desktop, and needs no script of its own. It runs from one to the
 * stock, capped at ten — a card is where someone picks up a thing or two,
 * and past that the cart's own stepper has no cap.
 */
export function QuantitySelect({
  value,
  stock,
  onChange,
  disabled = false,
  size = "sm",
  className = "",
}: {
  value: number;
  stock: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useI18n();
  const most = Math.max(1, Math.min(stock, MOST));
  const options = Array.from({ length: most }, (_, index) => index + 1);

  return (
    <span className={`quantity-select quantity-select-${size} ${className}`}>
      <select
        value={Math.min(value, most)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={t.product.quantity}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDownIcon size={13} aria-hidden className="quantity-select-chevron" />
    </span>
  );
}
