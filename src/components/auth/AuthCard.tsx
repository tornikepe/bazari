"use client";

import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/ui/Logo";
import { useSettings } from "@/components/providers/SettingsProvider";

/** Shared frame for the sign-in and sign-up pages. */
export function AuthCard({
  title,
  hint,
  children,
  footer,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const settings = useSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm animate-rise">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark size={40} />
          <Wordmark name={settings.name} className="text-xl" />
        </Link>

        <div className="card p-6">
          <h1 className="text-lg font-bold text-ink-900">{title}</h1>
          <p className="mt-1 text-sm text-ink-500">{hint}</p>
          {children}
        </div>

        <div className="mt-4 text-center text-sm text-ink-500">{footer}</div>

        <p className="mt-4 text-center text-xs text-ink-400">
          <Link href="/" className="hover:text-brand-600">
            ← {settings.name}
          </Link>
        </p>
      </div>
    </div>
  );
}
