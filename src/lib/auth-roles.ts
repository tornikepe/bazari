/**
 * Role vocabulary, importable from the client.
 *
 * Split out of `auth.ts`, which is `server-only` because it reads the session
 * cookie and talks to the database. The header and the account menu need to
 * know what a role *is* without any of that, and importing the server module
 * to get a union type would drag the whole thing into the client bundle — or,
 * more likely, fail the build.
 */
export type Role = "customer" | "admin" | "viewer";

/** Both staff roles reach the dashboard; only `admin` can change it. */
export function isStaff(role: Role) {
  return role === "admin" || role === "viewer";
}
