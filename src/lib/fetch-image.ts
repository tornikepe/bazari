import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { checkUpload, MAX_BYTES, type ImageType } from "@/lib/image-upload";

export type FetchedImage =
  | { ok: true; bytes: Uint8Array; type: ImageType }
  | { ok: false; reason: "bad-url" | "unreachable" | "too-large" | "not-an-image" };

const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "Bazari-Shop/1.0 (+https://bazari-one.vercel.app)";

/**
 * Whether an address is one the shop has no business asking its own server
 * to fetch.
 *
 * The person pasting a link here is a signed-in administrator of this shop,
 * so this is not the usual hostile-stranger case — but "fetch whatever URL
 * this field says" is still a request made by the server, from inside
 * wherever the server lives, and `http://169.254.169.254/` is a cloud
 * provider's metadata service rather than a photograph of a kettle.
 */
function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    // Loopback, link-local, unique-local, and v4 written as v6.
    if (v6 === "::1" || v6.startsWith("fe80:") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateAddress(mapped[1]!) : false;
  }

  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * Downloads a photograph the shop was given the address of, so it can keep
 * its own copy.
 *
 * The product form offers "or paste a link", and what it used to do with one
 * was store the address itself. Two things were wrong with that. The picture
 * belonged to somebody else's server, so the day they moved it the shop's
 * catalogue had a hole in it — and `next/image` refuses an address whose host
 * is not in `remotePatterns`, which it is not and cannot be, so the product
 * page and the home page answered **500** rather than showing a broken
 * image. A link that breaks two pages is not a convenience.
 *
 * So the bytes are fetched once, checked the way an upload is checked — by
 * what they actually are rather than by what the server said they were — and
 * stored. After this, every photo in the shop is one of the shop's own.
 */
export async function fetchImage(rawUrl: string): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "bad-url" };
  }

  // https only. Plain http would be a photograph anybody on the path could
  // replace on its way here.
  if (url.protocol !== "https:") return { ok: false, reason: "bad-url" };

  /* Each hop is resolved before it is requested, and the resolved address is
     what is judged — a hostname is free to point wherever it likes, and so is
     a redirect. Refusing redirects outright was the first try and it was
     wrong: nearly every image on a CDN is one, and the shop owner pasting the
     address sees a picture at the end of it. Three is enough for the chains
     that exist and short enough to be no kind of loop. */
  let response: Response | null = null;
  let target = url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (target.protocol !== "https:") return { ok: false, reason: "bad-url" };

    try {
      const addresses = await lookup(target.hostname, { all: true });
      if (addresses.length === 0) return { ok: false, reason: "unreachable" };
      if (addresses.some((entry) => privateAddress(entry.address))) {
        return { ok: false, reason: "bad-url" };
      }
    } catch {
      return { ok: false, reason: "unreachable" };
    }

    let hopResponse: Response;
    try {
      hopResponse = await fetch(target, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: "image/*",
          /* Named, because a great many hosts — Wikimedia among them —
             answer an anonymous request with nothing at all, and "the link
             you pasted could not be reached" would have been a lie about
             the shop owner's perfectly good address. */
          "user-agent": USER_AGENT,
        },
      });
    } catch {
      return { ok: false, reason: "unreachable" };
    }

    const location = hopResponse.headers.get("location");
    if (hopResponse.status >= 300 && hopResponse.status < 400 && location) {
      await hopResponse.body?.cancel();
      try {
        target = new URL(location, target);
      } catch {
        return { ok: false, reason: "bad-url" };
      }
      continue;
    }

    response = hopResponse;
    break;
  }

  if (!response) return { ok: false, reason: "unreachable" };
  if (!response.ok || !response.body) return { ok: false, reason: "unreachable" };

  // Read with a ceiling rather than reading it all and measuring afterwards:
  // a server that answers with a gigabyte should cost us one megabyte.
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreachable" };
  }

  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }

  const checked = checkUpload(bytes);
  if (!checked.ok) {
    return { ok: false, reason: checked.reason === "too-large" ? "too-large" : "not-an-image" };
  }

  return { ok: true, bytes, type: checked.type };
}
