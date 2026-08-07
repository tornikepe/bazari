"use client";

import { createContext, use } from "react";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/settings-defaults";

const SettingsContext = createContext<ShopSettings>(DEFAULT_SETTINGS);

/**
 * The shop's configuration, handed to the client tree.
 *
 * The cart is a client component and it needs the shipping rules; prices are
 * formatted on both sides and need the currency symbol. Both were constants
 * imported directly, which worked precisely because they could never change.
 * Now that they can, the values have to travel — read once on the server in
 * the root layout and passed down, the same shape as `I18nProvider`.
 *
 * The default is the real default rather than `null`, so a component rendered
 * outside the provider — a test, a Storybook story — gets working values
 * instead of a thrown error about missing context.
 */
export function SettingsProvider({
  settings,
  children,
}: {
  settings: ShopSettings;
  children: React.ReactNode;
}) {
  return <SettingsContext value={settings}>{children}</SettingsContext>;
}

export function useSettings() {
  return use(SettingsContext);
}
