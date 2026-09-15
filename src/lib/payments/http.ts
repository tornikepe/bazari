import "server-only";

/**
 * One way to talk to a gateway.
 *
 * Every adapter needs the same three things from HTTP: a timeout, because a
 * gateway that hangs must not hang the checkout; the body as JSON when it
 * is JSON and as text when it is not, so an error page is still reported;
 * and the status alongside, since a 4xx with a perfectly formed JSON body
 * is the usual way a gateway says no.
 */
export type GatewayResponse<T = unknown> = {
  ok: boolean;
  status: number;
  body: T;
  text: string;
};

export async function call<T = unknown>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<GatewayResponse<T>> {
  const { timeoutMs = 15_000, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { ok: response.ok, status: response.status, body: body as T, text };
  } finally {
    clearTimeout(timer);
  }
}

/** `application/x-www-form-urlencoded`, the shape every OAuth token endpoint wants. */
export function form(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

/** `Basic` for a client id and secret. */
export function basic(id: string, secret: string): string {
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

/** Lari with two decimals, as a string a gateway's JSON expects: 1234 tetri → "12.34". */
export function majorString(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Lari as a number for gateways that take a JSON number: 1234 tetri → 12.34. */
export function majorNumber(minor: number): number {
  return Math.round(minor) / 100;
}

/** A gateway's decimal — "12.34", 12.34 or "12,34" — back to minor units. */
export function toMinorUnits(value: unknown): number | null {
  const text =
    typeof value === "number"
      ? String(value)
      : typeof value === "string"
        ? value
        : "";
  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

/**
 * The order's lari as the foreign amount a gateway that takes no GEL is
 * asked for, at the rate the dashboard set — "2.70" GEL per unit — rounded
 * to the currency's minor unit. `null` on a rate that is not a number.
 */
export function convert(minorGel: number, rate: string): number | null {
  const perUnit = Number(String(rate).replace(",", "."));
  if (!Number.isFinite(perUnit) || perUnit <= 0) return null;
  return Math.round(minorGel / perUnit);
}

/** A short, safe reason from whatever a gateway sent back. */
export function reasonFrom(
  response: GatewayResponse,
  fallback: string,
): string {
  const body = response.body as {
    message?: string;
    error_description?: string;
    error?: string;
    developerMessage?: string;
  } | null;
  const said =
    body?.developerMessage ??
    body?.error_description ??
    body?.message ??
    body?.error ??
    "";
  return `${fallback} (${response.status}${said ? `: ${String(said).slice(0, 120)}` : ""})`;
}
