import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which provider answers.
 *
 * The failure this is really guarding against is a quiet one: someone sets
 * `CHAT_PROVIDER=anthropic` because they want the paid model, forgets the key,
 * and the free tier answers their customers for months without anyone
 * noticing. Falling back would be the "helpful" behaviour and the wrong one.
 */

// The providers pull in the tool definitions, which reach Prisma at import
// time. None of it runs here — this is about key detection and selection.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { activeProvider, isChatConfigured } = await import("@/lib/chat/providers");

const KEYS = ["GEMINI_API_KEY", "ANTHROPIC_API_KEY", "CHAT_PROVIDER"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.restoreAllMocks();
});

describe("activeProvider", () => {
  it("is null when no key is set, so the widget is never rendered", () => {
    expect(activeProvider()).toBeNull();
    expect(isChatConfigured()).toBe(false);
  });

  it("uses Gemini when only a Gemini key is set", () => {
    process.env.GEMINI_API_KEY = "test-key";

    expect(activeProvider()?.id).toBe("gemini");
    expect(isChatConfigured()).toBe(true);
  });

  it("uses Claude when only an Anthropic key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";

    expect(activeProvider()?.id).toBe("anthropic");
  });

  it("prefers the free provider when both keys are present", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-key";

    // Free by default; `CHAT_PROVIDER` is how you pay for the better one.
    expect(activeProvider()?.id).toBe("gemini");
  });

  it("honours an explicit override", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.CHAT_PROVIDER = "anthropic";

    expect(activeProvider()?.id).toBe("anthropic");
  });

  it("stays off — rather than falling back — when the named provider has no key", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.CHAT_PROVIDER = "anthropic";

    // The whole point of the test file. Someone who asked for the paid model
    // must see the assistant switched off, not the free one quietly serving.
    expect(activeProvider()).toBeNull();
    expect(isChatConfigured()).toBe(false);
  });

  it("stays off when CHAT_PROVIDER is a typo", () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.CHAT_PROVIDER = "gemeni";

    expect(activeProvider()).toBeNull();
  });

  it("ignores a key that is only whitespace", () => {
    process.env.GEMINI_API_KEY = "   ";

    expect(activeProvider()).toBeNull();
  });

  it("recovers a key that was pasted twice", () => {
    // The RESEND_API_KEY incident: a doubled paste arrives with a newline and
    // every request then fails with an invalid-header error that names nothing.
    process.env.GEMINI_API_KEY = "real-key\nreal-key";

    expect(activeProvider()?.id).toBe("gemini");
  });
});

describe("provider pricing", () => {
  it("prices the free tier at zero and the paid one at list rates", () => {
    process.env.GEMINI_API_KEY = "test-key";
    const free = activeProvider()!;
    expect(free.pricing).toEqual({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });

    delete process.env.GEMINI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    const paid = activeProvider()!;
    expect(paid.pricing.input).toBeGreaterThan(0);
    expect(paid.pricing.output).toBeGreaterThan(paid.pricing.input);
    // A cache read must stay far cheaper than fresh input, or the money cap
    // fires long before the money is actually spent.
    expect(paid.pricing.cacheRead).toBeLessThan(paid.pricing.input);
  });
});

describe("upstream throttling is its own thing", () => {
  it("recognises a 429 from either SDK's error shape", async () => {
    const { isUpstreamRateLimit, retryAfterSeconds, ProviderRateLimitError } = await import(
      "@/lib/chat/providers/types"
    );

    // Google throws an ApiError with a status; the Anthropic SDK's
    // RateLimitError carries one too. Both are 429, which is all we need.
    expect(isUpstreamRateLimit({ status: 429 })).toBe(true);
    expect(isUpstreamRateLimit({ status: 500 })).toBe(false);
    expect(isUpstreamRateLimit(new Error("nope"))).toBe(false);
    expect(isUpstreamRateLimit(null)).toBe(false);

    // Google buries the wait in the message body.
    const googleError = {
      status: 429,
      message: '{"error":{"details":[{"retryDelay": "40.556207827s"}]}}',
    };
    expect(retryAfterSeconds(googleError)).toBe(41);
    expect(retryAfterSeconds({ status: 429, message: "no delay here" })).toBeNull();
    expect(retryAfterSeconds({})).toBeNull();

    const thrown = new ProviderRateLimitError("gemini", 41);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.retryAfter).toBe(41);
  });
});
