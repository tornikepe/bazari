import { describe, expect, it } from "vitest";
import { renderInvoicePdf, type InvoiceOrder } from "@/lib/invoice-pdf";
import { DEFAULT_SETTINGS } from "@/lib/settings-defaults";

const order: InvoiceOrder = {
  number: "BZ-TEST0001",
  createdAt: new Date("2026-09-11T10:00:00Z"),
  customerName: "გიორგი ბერიძე",
  phone: "555000111",
  email: "giorgi@example.test",
  city: "თბილისი",
  address: "რუსთაველის 1",
  deliveryMethod: "courier",
  deliveryZoneKa: "თბილისი",
  deliveryZoneEn: "Tbilisi",
  items: [
    { nameKa: "USB-C კაბელი", nameEn: "USB-C cable", variantLabel: "2 m", sku: "CAB-1", quantity: 2, price: 1_900 },
    { nameKa: "ყურსასმენი", nameEn: "Earbuds", variantLabel: "", sku: "EAR-1", quantity: 1, price: 8_900 },
  ],
  subtotal: 12_700,
  shipping: 1_500,
  discount: 1_270,
  total: 12_930,
  tax: 1_972,
  taxRate: 18,
  couponCode: "WELCOME10",
};

describe("renderInvoicePdf", () => {
  it("renders a PDF in either language, with the Georgian font embedded", async () => {
    for (const locale of ["ka", "en"] as const) {
      const pdf = await renderInvoicePdf(order, { ...DEFAULT_SETTINGS, name: "Bazari" }, locale);
      // A PDF starts with its own name, and ends with its trailer.
      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(pdf.toString("latin1")).toContain("%%EOF");
      // Both weights went in: a font that is registered but never used is
      // not embedded, and every page uses both.
      expect(pdf.toString("latin1")).toContain("NotoSansGeorgian-Regular");
      expect(pdf.toString("latin1")).toContain("NotoSansGeorgian-Bold");
      // Small enough to attach to an email without a second thought.
      expect(pdf.byteLength).toBeLessThan(200_000);
    }
  });
});
