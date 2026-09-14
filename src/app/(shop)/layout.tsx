import { Footer } from "@/components/layout/Footer";
import { SkipLink } from "@/components/layout/SkipLink";
import { CartAnnouncer } from "@/components/cart/CartAnnouncer";
import { Header } from "@/components/layout/Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { isChatConfigured } from "@/lib/chat/providers";
import { TrafficBeacon } from "@/components/layout/TrafficBeacon";
import { ScrollProgress } from "@/components/layout/ScrollProgress";
import { PageTransition } from "@/components/layout/PageTransition";

/** Storefront chrome. The admin section deliberately sits outside this group. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SkipLink />
      <ScrollProgress />
      {/* One live region for the whole storefront. It has to outlive any single
          page, because a cart change on the product page and a removal on the
          cart page are the same event to somebody listening. */}
      <CartAnnouncer />
      <Header />
      {/* `tabIndex={-1}` so the skip link can actually move focus here: an
          element without it is a scroll target but not a focus target, and the
          next Tab would carry on from the header as though nothing happened. */}
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      {/* Whether the assistant can run is decided on the server and passed
          down, so an unconfigured deployment renders no launcher rather than
          one that fails when pressed. The dashboard is outside this layout —
          staff have the real data, not a chat window onto it. */}
      <ChatWidget available={isChatConfigured()} />
      {/* Counts the page. Storefront only — staff opening the dashboard are
          not traffic — and the beacon carries the path and nothing else. */}
      <TrafficBeacon />
    </>
  );
}
