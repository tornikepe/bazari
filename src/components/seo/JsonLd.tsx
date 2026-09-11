import { headers } from "next/headers";

/**
 * Structured data for search engines.
 *
 * `<script type="application/ld+json">` is still a script element as far as
 * CSP is concerned, so it needs the per-request nonce that `src/proxy.ts`
 * issues — without it the policy blocks the tag and the markup is invisible to
 * crawlers that execute CSP.
 *
 * The payload is serialised with `JSON.stringify`, and `<` is escaped so a
 * product name containing `</script>` cannot break out of the tag.
 */
export async function JsonLd({ data }: { data: Record<string, unknown> }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // The browser blanks `nonce` once the CSP has consumed it, so React
      // reads "" back where the server sent a value and reports a mismatch
      // it cannot fix. Nothing is patched; only the warning is silenced.
      suppressHydrationWarning
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
