import { RegisterForm } from "@/components/auth/RegisterForm";
import { SocialButtons } from "@/components/auth/SocialButtons";

/**
 * Server wrapper, same reason as the sign-in page: `SocialButtons` reads which
 * providers are configured from the environment, which must not reach the
 * browser bundle.
 */
export default function RegisterPage() {
  return <RegisterForm social={<SocialButtons />} />;
}
