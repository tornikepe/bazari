import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { SocialButtons } from "@/components/auth/SocialButtons";
import type { RawSearchParams } from "@/lib/filters";

/**
 * A server component wrapping the client form, so `SocialButtons` can read
 * which providers are configured. That check looks at environment variables
 * and must not cross into the browser bundle — the client has no business
 * knowing which credentials this deployment holds.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;

  // Same rule as the server action: same-origin paths only. `//evil.example`
  // is protocol-relative and browsers treat it as another origin, so checking
  // for a leading slash alone is not enough.
  const next = raw?.startsWith("/") && !raw.startsWith("//") ? raw : "";

  return (
    <Suspense>
      <LoginForm next={next} social={<SocialButtons next={next} />} />
    </Suspense>
  );
}
