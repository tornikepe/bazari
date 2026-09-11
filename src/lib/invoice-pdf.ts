import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { formatDateTime, formatPrice } from "@/lib/format";
import { fill, getDictionary, type Locale } from "@/lib/i18n";
import { vatIncluded } from "@/lib/tax";
import type { ShopSettings } from "@/lib/settings-defaults";

/**
 * The order as a PDF.
 *
 * The same document the order page prints — the shop's name and contact
 * lines, the number and the date, who it is for, the lines, the totals, the
 * VAT inside the total — drawn directly rather than by printing a page, so it
 * can be attached to the confirmation email and downloaded from the order
 * without a browser's print dialog in the way.
 *
 * `pdfkit` and two TrueType files, nothing else: no browser to launch, no
 * template language. Noto Sans Georgian in two weights, because a Georgian
 * invoice set in a font with no Georgian glyphs is a row of boxes, and the
 * same file carries the Latin letters and the lari sign, so one font does the
 * whole page in either language.
 *
 * It is not a fiscal document and says so, in the same words the printed page
 * uses: issuing one means a tax number and a numbering scheme an accountant
 * signs off.
 */

export type InvoiceOrder = {
  number: string;
  createdAt: Date;
  customerName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  deliveryMethod: "courier" | "pickup";
  deliveryZoneKa: string;
  deliveryZoneEn: string;
  items: {
    nameKa: string;
    nameEn: string;
    variantLabel: string;
    sku: string;
    quantity: number;
    price: number;
  }[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  tax: number;
  taxRate: number;
  couponCode?: string | null;
};

const FONT_DIR = join(process.cwd(), "assets");

/* Read once per process: the two files never change while it runs, and an
   invoice is drawn on every order with an email. */
let fontFiles: Promise<[Buffer, Buffer]> | null = null;
function fonts() {
  fontFiles ??= Promise.all([
    readFile(join(FONT_DIR, "NotoSansGeorgian-Regular.ttf")),
    readFile(join(FONT_DIR, "NotoSansGeorgian-Bold.ttf")),
  ]).catch((error) => {
    // A failed read must not be remembered, or one bad moment would be
    // every invoice from then on.
    fontFiles = null;
    throw error;
  });
  return fontFiles;
}

// Points. A4 with the margins the printed page uses.
const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const INK = "#161a23";
const MUTED = "#5f6675";
const LINE = "#d7dbe2";

export async function renderInvoicePdf(
  order: InvoiceOrder,
  settings: ShopSettings,
  locale: Locale,
): Promise<Buffer> {
  const t = getDictionary(locale);
  const [regular, bold] = await fonts();

  const doc = new PDFDocument({
    size: "A4",
    margin: PAGE.margin,
    info: { Title: `${t.orderDone.invoice} ${order.number}`, Author: settings.name },
  });
  doc.registerFont("regular", regular);
  doc.registerFont("bold", bold);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const name = (row: { nameKa: string; nameEn: string }) =>
    locale === "ka" ? row.nameKa : row.nameEn;
  const money = (tetri: number) => formatPrice(tetri, locale);
  const left = PAGE.margin;
  const right = PAGE.width - PAGE.margin;
  const width = right - left;

  /* ------------------------------ masthead ------------------------------ */
  doc.font("bold").fontSize(18).fillColor(INK).text(settings.name, left, PAGE.margin);
  doc.font("regular").fontSize(9).fillColor(MUTED);
  for (const line of [settings.contactAddress, settings.contactPhone, settings.contactEmail]) {
    if (line.trim()) doc.text(line);
  }
  const mastheadBottom = doc.y;

  doc.font("bold").fontSize(9).fillColor(MUTED);
  doc.text(t.orderDone.invoice, left, PAGE.margin, { width, align: "right" });
  doc.font("bold").fontSize(14).fillColor(INK).text(order.number, { width, align: "right" });
  doc
    .font("regular")
    .fontSize(9)
    .fillColor(MUTED)
    .text(`${t.orderDone.issued}: ${formatDateTime(order.createdAt)}`, { width, align: "right" });

  doc.y = Math.max(doc.y, mastheadBottom) + 14;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(1.5).strokeColor(INK).stroke();
  doc.y += 14;

  /* ------------------------------- bill to ------------------------------ */
  doc.font("bold").fontSize(8).fillColor(MUTED).text(t.orderDone.billTo, left);
  doc.font("bold").fontSize(11).fillColor(INK).text(order.customerName);
  doc.font("regular").fontSize(9).fillColor(MUTED);
  for (const line of [order.phone, order.email]) if (line.trim()) doc.text(line);

  const zone = locale === "ka" ? order.deliveryZoneKa : order.deliveryZoneEn;
  if (order.deliveryMethod === "pickup") {
    doc.text(
      `${t.checkout.deliveryPickup} · ${settings.pickupAddress || settings.contactAddress || settings.name}`,
    );
  } else {
    const where = [order.city, order.address].filter(Boolean).join(", ");
    doc.text(zone ? `${t.checkout.deliveryCourier} · ${zone} · ${where}` : where);
  }
  doc.y += 18;

  /* -------------------------------- lines ------------------------------- */
  /* No capitals anywhere on the page: Georgian has them — Mtavruli — and
     the site never sets them, so the PDF does not either. The headings are
     small, bold and grey instead, which is what the printed page does. */
  const columns = {
    name: { x: left, width: width * 0.5 },
    qty: { x: left + width * 0.52, width: width * 0.1 },
    price: { x: left + width * 0.64, width: width * 0.17 },
    total: { x: left + width * 0.82, width: width * 0.18 },
  };

  const headerY = doc.y;
  doc.font("bold").fontSize(8).fillColor(MUTED);
  doc.text(t.cart.item, columns.name.x, headerY, { width: columns.name.width });
  // "qty", not "quantity": the Georgian word does not fit a column.
  doc.text(t.returns.quantity, columns.qty.x, headerY, { width: columns.qty.width, align: "right" });
  doc.text(t.cart.price, columns.price.x, headerY, { width: columns.price.width, align: "right" });
  doc.text(t.cart.subtotal, columns.total.x, headerY, { width: columns.total.width, align: "right" });
  doc.y = headerY + 14;
  doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.y += 6;

  for (const item of order.items) {
    const rowY = doc.y;
    doc.font("regular").fontSize(10).fillColor(INK);
    doc.text(name(item), columns.name.x, rowY, { width: columns.name.width });
    const nameBottom = doc.y;
    if (item.variantLabel || item.sku) {
      doc.font("regular").fontSize(8).fillColor(MUTED);
      doc.text([item.variantLabel, item.sku].filter(Boolean).join(" · "), columns.name.x, nameBottom, {
        width: columns.name.width,
      });
    }
    const rowBottom = doc.y;

    doc.font("regular").fontSize(10).fillColor(INK);
    doc.text(String(item.quantity), columns.qty.x, rowY, { width: columns.qty.width, align: "right" });
    doc.text(money(item.price), columns.price.x, rowY, { width: columns.price.width, align: "right" });
    doc.font("bold").text(money(item.price * item.quantity), columns.total.x, rowY, {
      width: columns.total.width,
      align: "right",
    });

    doc.y = rowBottom + 6;
    doc.moveTo(left, doc.y).lineTo(right, doc.y).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.y += 6;
  }

  /* -------------------------------- totals ------------------------------ */
  // Georgian labels are long — "სულ გადასახდელი" is the total — so the
  // block takes more than half the page and the label two thirds of that.
  const totalsX = left + width * 0.42;
  const totalsWidth = width * 0.58;
  const labelWidth = totalsWidth * 0.64;
  const row = (label: string, value: string, strong = false) => {
    const y = doc.y;
    doc.font(strong ? "bold" : "regular").fontSize(strong ? 12 : 10).fillColor(strong ? INK : MUTED);
    doc.text(label, totalsX, y, { width: labelWidth });
    const labelBottom = doc.y;
    doc.fillColor(INK).text(value, totalsX + labelWidth, y, {
      width: totalsWidth - labelWidth,
      align: "right",
    });
    doc.y = Math.max(labelBottom, y + (strong ? 16 : 13)) + 3;
  };

  doc.y += 4;
  row(t.cart.itemsTotal, money(order.subtotal));
  row(t.cart.shipping, order.shipping <= 0 ? t.cart.freeShipping : money(order.shipping));
  if (order.discount > 0) {
    row(
      order.couponCode ? `${t.cart.discount} (${order.couponCode})` : t.cart.discount,
      `−${money(order.discount)}`,
    );
  }
  doc.moveTo(totalsX, doc.y).lineTo(right, doc.y).lineWidth(1).strokeColor(INK).stroke();
  doc.y += 6;
  row(t.cart.total, money(order.total), true);

  if (order.taxRate > 0) {
    doc.font("regular").fontSize(8).fillColor(MUTED);
    const y = doc.y;
    doc.text(fill(t.cart.taxIncluded, { rate: order.taxRate }), totalsX, y, { width: labelWidth });
    doc.text(money(order.tax || vatIncluded(order.total, order.taxRate)), totalsX + labelWidth, y, {
      width: totalsWidth - labelWidth,
      align: "right",
    });
    doc.y = y + 14;
  }

  /* ------------------------------- footer ------------------------------- */
  doc.y += 24;
  doc.font("regular").fontSize(8).fillColor(MUTED).text(t.orderDone.invoiceNote, left, doc.y, { width });

  doc.end();
  return done;
}
