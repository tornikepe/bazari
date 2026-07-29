import { describe, expect, it } from "vitest";
import { formatPrice, formatDate, slugify } from "@/lib/format";

/**
 * `formatPrice` is hand-rolled rather than using `Intl.NumberFormat`, because
 * Node and the browser disagreed on the Georgian locale — Node produced
 * "149,00" where the browser produced "149.00", which broke hydration on every
 * page with a price. These tests pin the output so that cannot come back.
 */
describe("formatPrice", () => {
  // Georgian uses U+00A0 (non-breaking space) both between thousands and
  // before the symbol, so a price can never wrap onto two lines.
  it("uses a comma decimal and a non-breaking space before the symbol in Georgian", () => {
    expect(formatPrice(149, "ka")).toBe("149,00\u00a0₾");
  });

  it("uses a dot decimal and a leading symbol in English", () => {
    expect(formatPrice(149, "en")).toBe("₾149.00");
  });

  it("always shows two decimal places", () => {
    expect(formatPrice(5, "en")).toBe("₾5.00");
    expect(formatPrice(5.5, "en")).toBe("₾5.50");
  });

  it("rounds to two places", () => {
    expect(formatPrice(5.554, "en")).toBe("₾5.55");
    expect(formatPrice(5.556, "en")).toBe("₾5.56");
  });

  it("rounds a halfway value the way the float actually is, not the way it reads", () => {
    // 5.555 is not exactly 5.555 in binary floating point — it is a hair
    // below — so `toFixed` gives 5.55 rather than the 5.56 the decimal
    // suggests. Pinned here because it is surprising, and because it is the
    // reason `Payment.amount` is stored as integer tetri: this rounding must
    // never be what decides an amount charged to a card.
    expect(formatPrice(5.555, "en")).toBe("₾5.55");
    expect(formatPrice(5.565, "en")).toBe("₾5.57");
  });

  it("groups thousands per locale", () => {
    expect(formatPrice(1234567.89, "en")).toBe("₾1,234,567.89");
    expect(formatPrice(1234567.89, "ka")).toBe("1\u00a0234\u00a0567,89\u00a0₾");
  });

  it("does not group a three-digit number", () => {
    expect(formatPrice(999, "en")).toBe("₾999.00");
  });

  it("groups a four-digit number", () => {
    expect(formatPrice(1000, "en")).toBe("₾1,000.00");
  });

  it("handles zero", () => {
    expect(formatPrice(0, "ka")).toBe("0,00\u00a0₾");
  });

  it("puts the minus before the digits, not the separator", () => {
    expect(formatPrice(-1234.5, "en")).toBe("₾-1,234.50");
  });

  it("falls back to zero for NaN and Infinity rather than printing them", () => {
    // A NaN reaching a price label is a visible bug; showing 0,00 is not.
    expect(formatPrice(Number.NaN, "ka")).toBe("0,00\u00a0₾");
    expect(formatPrice(Number.POSITIVE_INFINITY, "ka")).toBe("0,00\u00a0₾");
  });

  it("defaults to Georgian", () => {
    expect(formatPrice(1)).toBe(formatPrice(1, "ka"));
  });

  it("produces the same string on every call — no locale or timezone drift", () => {
    // The property that actually protects hydration.
    const runs = Array.from({ length: 50 }, () => formatPrice(1234.56, "ka"));
    expect(new Set(runs).size).toBe(1);
  });
});

describe("formatDate", () => {
  it("renders dd.mm.yyyy in UTC", () => {
    expect(formatDate(new Date("2026-03-07T12:00:00Z"))).toBe("07.03.2026");
  });

  it("zero-pads day and month", () => {
    expect(formatDate(new Date("2026-01-05T00:00:00Z"))).toBe("05.01.2026");
  });

  it("accepts an ISO string", () => {
    expect(formatDate("2026-12-31T23:59:59Z")).toBe("31.12.2026");
  });

  it("does not shift the date across a timezone boundary", () => {
    // Local-time formatting would render this as the 31st in Tbilisi.
    expect(formatDate(new Date("2026-01-01T00:30:00Z"))).toBe("01.01.2026");
  });
});

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("Anker PowerCore 20000mAh")).toBe("anker-powercore-20000mah");
  });

  it("collapses repeated separators", () => {
    expect(slugify("a   b---c")).toBe("a-b-c");
  });

  it("trims leading and trailing separators", () => {
    expect(slugify("  hello  ")).toBe("hello");
  });
});
