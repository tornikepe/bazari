import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { isChatConfigured } from "@/lib/chat/providers";

/** Storefront chrome. The admin section deliberately sits outside this group. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="animate-fade flex-1">{children}</main>
      <Footer />
      {/* Whether the assistant can run is decided on the server and passed
          down, so an unconfigured deployment renders no launcher rather than
          one that fails when pressed. The dashboard is outside this layout —
          staff have the real data, not a chat window onto it. */}
      <ChatWidget available={isChatConfigured()} />
    </>
  );
}
