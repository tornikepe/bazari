"use client";

import { forwardRef, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

/**
 * A password box with an eye at its end that shows what was typed. The
 * eye is a button with a label that says which way it is about to go, so
 * it reads right without sight of the icon.
 */
export const PasswordField = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className"> & { invalid?: boolean }
>(function PasswordField({ invalid = false, ...props }, ref) {
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={shown ? "text" : "password"}
        aria-invalid={invalid || undefined}
        {...props}
        className="field pr-11"
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? t.auth.hidePassword : t.auth.showPassword}
        aria-pressed={shown}
        className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-control text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        {shown ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
      </button>
    </div>
  );
});
