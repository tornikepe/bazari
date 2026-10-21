/**
 * Which provider is behind a connection string, and where its console is.
 *
 * Supabase is the awkward one and the one this shop is on. Its pooled
 * string names a shared host — `aws-0-eu-west-1.pooler.supabase.com` —
 * which says nothing about *which* project, so the project's reference is
 * taken from the user instead: the pooler signs in as `postgres.<ref>`.
 * The unpooled string carries it in the host as `db.<ref>.supabase.co`.
 * Without the reference the console link would land on a list of projects
 * rather than on this one, which is a door to the wrong room.
 */
export function describeDatabase(url: string, override?: string) {
  let host = "";
  let user = "";
  try {
    const parsed = new URL(url);
    host = parsed.hostname;
    user = decodeURIComponent(parsed.username);
  } catch {
    return { host: "", provider: "", consoleUrl: override ?? "" };
  }

  const supabase = host.endsWith("supabase.com") || host.endsWith("supabase.co");
  const ref = supabase
    ? (/^postgres\.([a-z0-9]+)$/.exec(user)?.[1] ?? /^db\.([a-z0-9]+)\./.exec(host)?.[1] ?? "")
    : "";

  const provider = supabase
    ? "Supabase"
    : host.endsWith("neon.tech")
      ? "Neon"
      : host.endsWith("prisma.io")
        ? "Prisma Postgres"
        : "PostgreSQL";

  const guessed = supabase
    ? ref
      ? `https://supabase.com/dashboard/project/${ref}`
      : "https://supabase.com/dashboard/projects"
    : host.endsWith("neon.tech")
      ? "https://console.neon.tech/"
      : host.endsWith("prisma.io")
        ? "https://console.prisma.io/"
        : "";

  return { host, provider, consoleUrl: override || guessed };
}
