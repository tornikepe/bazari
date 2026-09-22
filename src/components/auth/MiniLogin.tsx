"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { fill } from "@/lib/i18n";
import { login, type AuthState } from "@/app/actions/auth";
import { PasswordField } from "@/components/ui/PasswordField";
import { SpinnerIcon } from "@/components/ui/icons";
import { shakeField, useFieldShake } from "@/components/ui/field-fault";
import { useHoverPanelPin } from "@/components/layout/HoverPanel";

/**
 * The sign-in, in the panel under the account icon: email or phone, the
 * password with its eye, one button, and the two ways out of it — an
 * account to create, a password forgotten. The same action the sign-in
 * page runs, told to come back to the page the panel was opened on.
 */
export function MiniLogin({ social }: { social?: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});
  const wrong = Boolean(state.error);
  const pin = useHoverPanelPin();
  /** Which of the two was left empty on the last press. */
  const [missing, setMissing] = useState<{ identifier?: boolean; password?: boolean }>({});

  useFieldShake(state, wrong, ["mini-identifier", "mini-password"]);

  /* The panel stays put while the form is in use and after a wrong
     password: it used to vanish as the press disabled the button, so the
     answer was never seen. */
  useEffect(() => {
    if (wrong || pending) pin?.(true);
  }, [wrong, pending, pin]);

  return (
    <form
      action={formAction}
      /* Our own check rather than the browser's bubble: an empty box
         reddens and shakes where it stands, and the panel stays open. */
      noValidate
      onSubmit={(event) => {
        pin?.(true);
        const data = new FormData(event.currentTarget);
        const identifier = String(data.get("email") ?? "").trim();
        const password = String(data.get("password") ?? "");
        if (identifier && password) {
          setMissing({});
          return;
        }
        event.preventDefault();
        setMissing({ identifier: !identifier, password: !password });
        if (!identifier) shakeField(document.getElementById("mini-identifier"));
        if (!password) shakeField(document.getElementById("mini-password"));
      }}
      className="flex flex-col gap-3 p-4"
    >
      <input type="hidden" name="next" value={pathname === "/login" ? "/account" : pathname} />

      {/* The other way in, above the form and under its own small line:
          most people who have a Google account will use it. */}
      {social}

      <div>
        <label className="field-label block text-center" htmlFor="mini-identifier">
          {t.auth.identifier}
        </label>
        <input
          id="mini-identifier"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          aria-invalid={wrong || missing.identifier || undefined}
          onChange={() => missing.identifier && setMissing((current) => ({ ...current, identifier: false }))}
          className="field h-10 text-center"
        />
      </div>

      <div>
        <label className="field-label block text-center" htmlFor="mini-password">
          {t.auth.password}
        </label>
        <PasswordField
          id="mini-password"
          name="password"
          autoComplete="current-password"
          invalid={wrong || Boolean(missing.password)}
          onChange={() => missing.password && setMissing((current) => ({ ...current, password: false }))}
        />
      </div>

      {/* A wrong pair reddens the two boxes and says nothing else — see
          `useFieldShake`. Only the wait after too many tries needs words,
          because the boxes cannot say how long. */}
      {state.error === "rate-limited" && (
        <p role="alert" className="text-center text-xs font-semibold text-danger">
          {fill(t.auth.rateLimited, { minutes: String(state.retryMinutes ?? 15) })}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary btn-md w-full">
        {pending && <SpinnerIcon size={16} />}
        {pending ? t.auth.signingIn : t.auth.signIn}
      </button>

      {/* Two rows with a hairline between, not two words at either end of
          one line — in a 19rem panel the two ran into each other. */}
      <div className="flex flex-col text-xs">
        <Link
          href="/register"
          className="flex min-h-10 items-center justify-between gap-3 border-t border-line font-semibold text-ink-900 hover:text-brand-600"
        >
          {t.auth.createAccount}
          <span aria-hidden="true">→</span>
        </Link>
        <Link
          href="/forgot-password"
          className="flex min-h-10 items-center justify-between gap-3 border-t border-line text-ink-500 hover:text-ink-900"
        >
          {t.auth.forgot}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </form>
  );
}
