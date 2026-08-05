import type { Locale } from "@/lib/i18n";

export const CURRENCY = "₾";

/**
 * `1 250,00 ₾` in Georgian, `₾1,250.00` in English.
 *
 * **Takes tetri**, not lari — every amount in the database and in the cart is
 * a whole number of tetri, and this is the single place that divides by 100.
 * Keeping the split here means no arithmetic anywhere else can round.
 *
 * Grouping is done by hand rather than with `Intl.NumberFormat`: Node and the
 * browser ship different ICU data for `ka-GE` (comma vs dot decimal), so the
 * server and client rendered different text and hydration failed. Same reason
 * `formatDate` below avoids `Intl`.
 */
export function formatPrice(tetri: number, locale: Locale = "ka") {
  const safe = Number.isFinite(tetri) ? Math.round(tetri) : 0;
  const negative = safe < 0;

  // Integer division, so the decimal part is exact by construction.
  const units = Math.abs(safe);
  const whole = String(Math.floor(units / 100));
  const fraction = String(units % 100).padStart(2, "0");
  const groupSeparator = locale === "ka" ? " " : ",";
  const decimalSeparator = locale === "ka" ? "," : ".";

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  const amount = `${negative ? "-" : ""}${grouped}${decimalSeparator}${fraction}`;

  return locale === "ka" ? `${amount} ${CURRENCY}` : `${CURRENCY}${amount}`;
}

/**
 * The shop's clock.
 *
 * Every date on this site used to be rendered from `getUTCHours()` and
 * friends. The reasoning was sound — `Intl` with a *runtime-derived* timezone
 * gives one answer on the server and another in the browser, which is a
 * hydration mismatch — but the conclusion was wrong. UTC is deterministic and
 * also incorrect: the shop is in Georgia, four hours ahead, so an order
 * confirmed at 01:00 in Tbilisi was displayed as 21:00 *the previous day*, and
 * anything happening between midnight and 04:00 was filed under yesterday.
 *
 * A hardcoded zone is both. It is the same string on the server and in the
 * browser because it is not derived from anything, and it is the time the
 * person reading the screen is actually living in.
 */
const SHOP_TIME_ZONE = "Asia/Tbilisi";

/**
 * `h23` rather than `hour12: false`: some ICU versions render midnight as
 * "24:00" for the latter, which is a valid reading of the standard and a
 * confusing thing to put in an order history.
 */
const TBILISI = new Intl.DateTimeFormat("en-GB", {
  timeZone: SHOP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * The pieces are reassembled by hand rather than taking `Intl`'s formatted
 * string, so the layout is fixed by this file instead of by whatever locale
 * conventions the runtime happens to ship.
 */
function shopParts(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts: Record<string, string> = {};
  for (const part of TBILISI.formatToParts(date)) parts[part.type] = part.value;
  return parts;
}

/** `dd.mm.yyyy`, in shop time. */
export function formatDate(value: Date | string) {
  const { day, month, year } = shopParts(value);
  return `${day}.${month}.${year}`;
}

/** `dd.mm.yyyy hh:mm`, in shop time. */
export function formatDateTime(value: Date | string) {
  const { day, month, year, hour, minute } = shopParts(value);
  return `${day}.${month}.${year} ${hour}:${minute}`;
}

/**
 * The instant the shop's day containing `value` began.
 *
 * Needed because a query boundary and a chart bucket have to agree. Flooring
 * to UTC midnight is four hours out from midnight in Tbilisi, so a window
 * built that way includes orders it never draws a bar for: after 20:00 UTC the
 * shop is already on the next day, the revenue total counts those orders and
 * the chart has nowhere to put them. The bars then quietly fail to add up to
 * the figure printed beside them.
 *
 * The offset is derived from `Intl` rather than hardcoded to +4, so this keeps
 * working if Georgia ever reintroduces daylight saving.
 */
export function shopDayStart(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  const { year, month, day, hour, minute } = shopParts(date);

  // The Tbilisi wall clock read back as if it were UTC. Its distance from the
  // real instant is the zone's offset at that moment. Both sides are floored
  // to the minute, because `shopParts` has no seconds and the difference would
  // otherwise carry whatever seconds the input happened to hold.
  const wallAsUtc = Date.UTC(+year, +month - 1, +day, +hour, +minute);
  const offset = wallAsUtc - Math.floor(date.getTime() / 60_000) * 60_000;

  return new Date(Date.UTC(+year, +month - 1, +day) - offset);
}

/** `YYYY-MM-DD` in shop time — for grouping rows into days, not for display. */
export function shopDayKey(value: Date | string) {
  const { day, month, year } = shopParts(value);
  return `${year}-${month}-${day}`;
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
