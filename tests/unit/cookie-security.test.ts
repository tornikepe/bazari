import { afterEach, describe, expect, it, vi } from "vitest";
import { secureCookiesFor } from "@/lib/cookie-security";

/**
 * The rule that decides whether a cookie carries `Secure`.
 *
 * Worth testing rather than reading, because the two ways of getting it wrong
 * are not symmetrical. Setting `Secure` on a plain-http response loses the
 * cookie and the reader cannot sign in; *not* setting it on a real deployment
 * lets the session travel in clear text if anything ever downgrades. So the
 * cases below are mostly about the second kind: every situation that is not
 * demonstrably http has to keep the flag.
 */

const request = (headers: Record<string, string>) => new Request("https://example.test/", { headers });

afterEach(() => vi.unstubAllEnvs());

describe("secureCookiesFor", () => {
  it("never sets Secure outside a production build", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(secureCookiesFor(request({ host: "shop.example" }))).toBe(false);
    expect(secureCookiesFor(request({ "x-forwarded-proto": "https" }))).toBe(false);
  });

  describe("in production", () => {
    const inProduction = () => vi.stubEnv("NODE_ENV", "production");

    it("believes the proxy when it says https", () => {
      inProduction();
      expect(secureCookiesFor(request({ "x-forwarded-proto": "https" }))).toBe(true);
    });

    it("reads only the first hop", () => {
      // `x-forwarded-proto` accumulates one value per proxy. The client's is
      // the first; a later hop being http says nothing about the browser.
      inProduction();
      expect(secureCookiesFor(request({ "x-forwarded-proto": "https, http" }))).toBe(true);
      expect(secureCookiesFor(request({ "x-forwarded-proto": "http, https" }))).toBe(false);
    });

    it("drops Secure when the proxy says the browser spoke http", () => {
      // Otherwise the cookie is discarded by the browser and the session is
      // lost the moment it is created — which is exactly what happened in
      // WebKit against a local production build.
      inProduction();
      expect(secureCookiesFor(request({ "x-forwarded-proto": "http" }))).toBe(false);
    });

    it("drops Secure for a loopback host with no proxy at all", () => {
      inProduction();
      for (const host of ["localhost:3000", "127.0.0.1:3100", "[::1]:3000", "localhost"]) {
        expect(secureCookiesFor(request({ host })), host).toBe(false);
      }
    });

    it("keeps Secure for a real host with no proxy headers", () => {
      // The important direction. A deployment whose proxy sets no headers must
      // not quietly lose the flag.
      inProduction();
      expect(secureCookiesFor(request({ host: "bazari.ge" }))).toBe(true);
      expect(secureCookiesFor(request({ host: "shop.example:8443" }))).toBe(true);
    });

    it("keeps Secure when there are no headers to go on", () => {
      inProduction();
      expect(secureCookiesFor(request({}))).toBe(true);
    });

    it("is not fooled by a host that merely contains a loopback name", () => {
      inProduction();
      expect(secureCookiesFor(request({ host: "localhost.example.com" }))).toBe(true);
      expect(secureCookiesFor(request({ host: "not-localhost" }))).toBe(true);
      expect(secureCookiesFor(request({ host: "127.0.0.1.example.com" }))).toBe(true);
    });
  });
});
