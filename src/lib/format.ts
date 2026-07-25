import type { Locale } from "@/lib/i18n";

export const CURRENCY = "₾";

/**
 * `1 250,00 ₾` in Georgian, `₾1,250.00` in English.
 *
 * Grouping is done by hand rather than with `Intl.NumberFormat`: Node and the
 * browser ship different ICU data for `ka-GE` (comma vs dot decimal), so the
 * server and client rendered different text and hydration failed. Same reason
 * `formatDate` below avoids `Intl`.
 */
export function formatPrice(value: number, locale: Locale = "ka") {
  const safe = Number.isFinite(value) ? value : 0;
  const negative = safe < 0;

  const [whole, fraction] = Math.abs(safe).toFixed(2).split(".");
  const groupSeparator = locale === "ka" ? " " : ",";
  const decimalSeparator = locale === "ka" ? "," : ".";

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  const amount = `${negative ? "-" : ""}${grouped}${decimalSeparator}${fraction}`;

  return locale === "ka" ? `${amount} ${CURRENCY}` : `${CURRENCY}${amount}`;
}

/**
 * Deterministic `dd.mm.yyyy` — `Intl` with a runtime-derived timezone would
 * render differently on the server and the client and break hydration.
 */
export function formatDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
}

export function formatDateTime(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatDate(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function discountPercent(price: number, oldPrice?: number | null) {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** URL-safe slug that keeps Georgian letters readable by transliterating them. */
const GEORGIAN_MAP: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t", ი: "i",
  კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh", რ: "r", ს: "s",
  ტ: "t", უ: "u", ფ: "f", ქ: "q", ღ: "gh", ყ: "y", შ: "sh", ჩ: "ch", ც: "ts",
  ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh", ჯ: "j", ჰ: "h",
};

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .split("")
    .map((char) => GEORGIAN_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
