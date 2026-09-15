import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { NotFoundView } from "@/components/layout/NotFoundView";

/**
 * Root 404. It renders its own chrome because `not-found.tsx` at the app root
 * sits outside the `(shop)` group and so doesn't inherit that layout. Inside
 * the group, `(shop)/not-found.tsx` renders the same view under the layout.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <NotFoundView />
      </main>
      <Footer />
    </>
  );
}
