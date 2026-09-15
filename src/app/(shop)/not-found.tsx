import { NotFoundView } from "@/components/layout/NotFoundView";

/**
 * The shop's 404 — a product or a page that does not exist. The layout
 * around this already draws the header and the footer, which is why this
 * is not the root `not-found.tsx`: that one draws its own, and here it drew
 * a second pair.
 */
export default function ShopNotFound() {
  return <NotFoundView />;
}
