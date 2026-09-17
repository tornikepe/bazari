/**
 * Georgian mobile numbers, as the shop takes and keeps them.
 *
 * A number is typed as nine digits after a fixed `+995` — `5XX XX XX XX`,
 * the way it is printed on a business card — and stored the same way, with
 * the spaces, so every order, address and account shows one shape. A login
 * by phone normalises whatever was typed to that shape before looking it up.
 */

export const PHONE_PREFIX = "+995";

/** The nine digits, spaced `XXX XX XX XX` as far as they go. */
export function formatDigits(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 9);
  const parts = [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

/**
 * The nine local digits out of anything a person might type: with or
 * without `+995`, `995`, a leading `0`, spaces or dashes. Null when it is
 * not a Georgian mobile number.
 */
export function localDigits(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("995") && d.length === 12) d = d.slice(3);
  if (d.length === 10 && d.startsWith("0")) d = d.slice(1);
  return /^5\d{8}$/.test(d) ? d : null;
}

/** `+995 5XX XX XX XX`, or null when the input is not a number. */
export function normalizePhone(raw: string): string | null {
  const d = localDigits(raw);
  return d ? `${PHONE_PREFIX} ${formatDigits(d)}` : null;
}

/** Whether a login identifier is a phone rather than an address. */
export function looksLikePhone(value: string): boolean {
  return !value.includes("@") && /\d{6,}/.test(value.replace(/\D/g, ""));
}
