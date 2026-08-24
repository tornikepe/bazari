/**
 * Which dashboard listings can have a view saved on them.
 *
 * Written out rather than taken from the routes, because a Server Action is
 * reachable by direct POST and `page` decides what is revalidated: an open
 * string here would be an open string in `revalidatePath`.
 *
 * A plain module rather than part of the action file, so a Client Component
 * can import the list without pulling a `"use server"` module into the bundle.
 */
export const SAVED_VIEW_PAGES = ["orders", "products", "customers"] as const;

export type SavedViewPage = (typeof SAVED_VIEW_PAGES)[number];

export function isSavedViewPage(value: unknown): value is SavedViewPage {
  return typeof value === "string" && (SAVED_VIEW_PAGES as readonly string[]).includes(value);
}
