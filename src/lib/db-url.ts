/**
 * The database connection string, with its TLS mode written out.
 *
 * Deliberately not `server-only`: the backup, restore and audit scripts open
 * their own connections and must go through the same door.
 *
 * `pg` today treats `sslmode=prefer`, `require` and `verify-ca` as
 * `verify-full` — the server's certificate really is checked against a
 * trusted authority and against the host being dialled. It warns, loudly and
 * on every connection, that a coming major version will give those words
 * their libpq meanings instead, under which `require` means "encrypt, and
 * verify nothing at all".
 *
 * That difference matters. A connection nobody verifies is one somebody
 * between here and the database can sit in the middle of, reading every
 * order and every address as they go past, and it would arrive silently —
 * inside a routine dependency bump, with nothing in the diff about TLS.
 *
 * So the mode is spelled out. Nothing changes today, because `verify-full`
 * is exactly what these three already mean; what changes is that they go on
 * meaning it after the upgrade. `disable` and `no-verify` are left alone:
 * somebody wrote those on purpose.
 */

/** The modes that currently alias to `verify-full` and would stop. */
const ALIASED = new Set(["prefer", "require", "verify-ca"]);

export function withVerifiedTls(url: string): string {
  try {
    const parsed = new URL(url);
    const mode = parsed.searchParams.get("sslmode");
    if (mode && ALIASED.has(mode)) {
      parsed.searchParams.set("sslmode", "verify-full");
      return parsed.toString();
    }
    return url;
  } catch {
    // Not a URL we can parse — a socket path, something unusual. Whatever it
    // is, it is the caller's and we hand it back untouched.
    return url;
  }
}
