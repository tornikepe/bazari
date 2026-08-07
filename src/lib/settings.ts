import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/settings-defaults";

/**
 * The shop's own configuration — everything that is not a product.
 *
 * ## Why it is cached per request
 *
 * Almost every server-rendered page needs at least one of these — the header
 * needs the name, the cart needs the shipping rules, the footer needs the
 * contact details. `cache()` from React deduplicates them into a single query
 * per request without any of them having to know about the others.
 */

export { DEFAULT_SETTINGS, type ShopSettings } from "@/lib/settings-defaults";

export const SETTINGS_ID = "shop";

export const getSettings = cache(async (): Promise<ShopSettings> => {
  try {
    const row = await prisma.shopSettings.findUnique({ where: { id: SETTINGS_ID } });
    if (!row) return DEFAULT_SETTINGS;

    // Field by field rather than spreading the row: the row carries `id` and
    // `updatedAt`, which are storage details no caller should receive, and
    // this way adding a column is a deliberate act rather than something that
    // leaks outward on its own.
    return {
      name: row.name,
      titleSuffixKa: row.titleSuffixKa,
      titleSuffixEn: row.titleSuffixEn,
      taglineKa: row.taglineKa,
      taglineEn: row.taglineEn,
      logoUrl: row.logoUrl,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      contactAddress: row.contactAddress,
      contactHoursKa: row.contactHoursKa,
      contactHoursEn: row.contactHoursEn,
      currencySymbol: row.currencySymbol,
      freeShippingThreshold: row.freeShippingThreshold,
      shippingFee: row.shippingFee,
      codEnabled: row.codEnabled,
    };
  } catch (error) {
    // Deliberately not rethrown. Every page needs this, so a throw here is a
    // site-wide outage caused by a configuration read.
    console.error("[settings] falling back to defaults", error);
    return DEFAULT_SETTINGS;
  }
});

/** The browser tab title: the shop's name plus its suffix for that language. */
export function siteTitle(settings: ShopSettings, locale: "ka" | "en") {
  const suffix = locale === "ka" ? settings.titleSuffixKa : settings.titleSuffixEn;
  return suffix ? `${settings.name} - ${suffix}` : settings.name;
}
