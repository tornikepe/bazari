import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, shopDayKey } from "@/lib/format";

/**
 * Dates are rendered in the shop's own timezone.
 *
 * Every date on the site used to be built from `getUTC*`. That was chosen for
 * a real reason — `Intl` with a *runtime-derived* zone answers differently on
 * the server and in the browser, which is a hydration mismatch — but the fix
 * was wrong. Georgia is four hours ahead of UTC, so anything that happened
 * between midnight and 04:00 in Tbilisi was displayed as the previous day: an
 * order confirmed at 01:00 on the 5th read as 21:00 on the 4th.
 *
 * A hardcoded zone is deterministic *and* correct. These pin the boundary
 * cases, which are the only ones where the two ever disagreed and therefore
 * the only ones anybody would notice.
 */
describe("shop time", () => {
  it("keeps an early-morning Tbilisi event on its own day", () => {
    // 2026-08-04 22:30 UTC is 2026-08-05 02:30 in Tbilisi.
    const instant = new Date("2026-08-04T22:30:00Z");

    expect(formatDate(instant)).toBe("05.08.2026");
    expect(formatDateTime(instant)).toBe("05.08.2026 02:30");
    expect(shopDayKey(instant)).toBe("2026-08-05");
  });

  it("does not push a late-evening event into tomorrow", () => {
    // 2026-08-04 19:00 UTC is 23:00 the same day in Tbilisi — still the 4th.
    const instant = new Date("2026-08-04T19:00:00Z");

    expect(formatDate(instant)).toBe("04.08.2026");
    expect(shopDayKey(instant)).toBe("2026-08-04");
  });

  it("renders midnight as 00:00, never 24:00", () => {
    // `hour12: false` produces "24:00" on some ICU builds, which is a valid
    // reading of the standard and a baffling thing to see in an order history.
    const instant = new Date("2026-08-04T20:00:00Z"); // 00:00 on the 5th
    expect(formatDateTime(instant)).toBe("05.08.2026 00:00");
  });

  it("agrees with itself across the three formatters", () => {
    // `shopDayKey` groups the chart's bars and `formatDate` labels the rows.
    // If they ever disagreed, a daily total would sit under the wrong date and
    // nobody would find out until they added the orders up by hand.
    for (const iso of [
      "2026-01-01T00:00:00Z",
      "2026-08-04T20:00:00Z",
      "2026-08-04T23:59:59Z",
      "2026-12-31T21:00:00Z",
    ]) {
      const instant = new Date(iso);
      const [year, month, day] = shopDayKey(instant).split("-");
      expect(formatDate(instant)).toBe(`${day}.${month}.${year}`);
    }
  });

  it("is stable regardless of the machine's own timezone", () => {
    // The server runs in UTC on Vercel and in whatever the laptop is set to
    // locally. Both must print the same string, or the same order shows two
    // different times depending on who rendered it.
    const instant = new Date("2026-08-04T22:30:00Z");
    const before = process.env.TZ;
    try {
      process.env.TZ = "America/Los_Angeles";
      expect(formatDateTime(instant)).toBe("05.08.2026 02:30");
      process.env.TZ = "UTC";
      expect(formatDateTime(instant)).toBe("05.08.2026 02:30");
    } finally {
      process.env.TZ = before;
    }
  });
});

describe("shopDayStart", () => {
  it("returns midnight in Tbilisi, not midnight UTC", async () => {
    const { shopDayStart } = await import("@/lib/format");

    // 22:30 UTC on the 4th is 02:30 on the 5th in shop time, so the day it
    // belongs to began at 20:00 UTC on the 4th.
    const start = shopDayStart(new Date("2026-08-04T22:30:00Z"));
    expect(start.toISOString()).toBe("2026-08-04T20:00:00.000Z");
  });

  it("is idempotent — the start of a day is in that same day", async () => {
    const { shopDayStart, shopDayKey } = await import("@/lib/format");

    for (const iso of [
      "2026-01-01T00:00:00Z",
      "2026-08-04T20:00:00Z",
      "2026-08-04T19:59:59Z",
      "2026-06-15T12:00:00Z",
    ]) {
      const instant = new Date(iso);
      const start = shopDayStart(instant);
      expect(shopDayKey(start), iso).toBe(shopDayKey(instant));
      expect(shopDayStart(start).getTime(), iso).toBe(start.getTime());
    }
  });

  it("never returns an instant after the one it was given", async () => {
    const { shopDayStart } = await import("@/lib/format");

    for (let hour = 0; hour < 24; hour++) {
      const instant = new Date(Date.UTC(2026, 7, 4, hour, 30));
      expect(shopDayStart(instant).getTime(), `${hour}:30 UTC`).toBeLessThanOrEqual(
        instant.getTime(),
      );
    }
  });
});
