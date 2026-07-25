import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/** Storefront chrome. The admin section deliberately sits outside this group. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
