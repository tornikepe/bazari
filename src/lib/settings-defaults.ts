/**
 * The settings shape and its fallback values, importable from the client.
 *
 * Split out of `settings.ts` for the same reason `auth-roles.ts` is split out
 * of `auth.ts`: that module is `server-only` because it reads the database,
 * and the cart provider needs the *type* and the defaults without any of that.
 * Importing the server module to get them would drag Prisma into the browser
 * bundle, or more likely fail the build.
 */
export type ShopSettings = {
  name: string;
  titleSuffixKa: string;
  titleSuffixEn: string;
  taglineKa: string;
  taglineEn: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactHoursKa: string;
  contactHoursEn: string;
  currencySymbol: string;
  /** Tetri, like every other amount in the app. */
  freeShippingThreshold: number;
  shippingFee: number;
  codEnabled: boolean;
};

/**
 * What the code used before any of this was configurable.
 *
 * Also the fallback when the settings row cannot be read: every page needs
 * some of this, so a database hiccup should render the shop with sensible
 * values rather than take the site down over a shipping threshold.
 */
export const DEFAULT_SETTINGS: ShopSettings = {
  name: "Bazari",
  titleSuffixKa: "ონლაინ მაღაზია",
  titleSuffixEn: "online store",
  taglineKa: "",
  taglineEn: "",
  logoUrl: "",
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
  contactHoursKa: "",
  contactHoursEn: "",
  currencySymbol: "₾",
  freeShippingThreshold: 20_000,
  shippingFee: 1_500,
  codEnabled: true,
};
