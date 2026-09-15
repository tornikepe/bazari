import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { formatDateTime, formatPrice } from "@/lib/format";
import { fill, getDictionary, type Locale } from "@/lib/i18n";
import { vatIncluded } from "@/lib/tax";
import type { ShopSettings } from "@/lib/settings-defaults";
import type { PaymentMethod, PaymentStatus } from "@/lib/payment";

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
  /** How it was, or is to be, paid — and whether it has been. */
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  /** The company line the customer set on their payment page, if any. */
  billingCompany?: string;
  billingTaxId?: string;
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
const PAGE = { width: 595.28, height: 841.89, margin: 44 };
const INK = "#161a23";
const MUTED = "#5f6675";
const LINE = "#e3e6ec";
const PANEL = "#f4f5f8";
const BRAND = "#dc1f24";
const BRAND_DEEP = "#9a161b";
const SUCCESS = "#11813a";
const SUCCESS_SOFT = "#dcfce7";
const WARNING = "#a75c05";
const WARNING_SOFT = "#fef3c7";

/**
 * The invoice, drawn.
 *
 * A band of the brand colour across the top with the shop's name and the
 * document's number, two panels under it — who it is for and what the
 * order is — a ruled table of the lines with the columns aligned, a totals
 * box on the right with the sum set large, a stamp saying whether it is
 * paid, and the shop's contact lines along the foot. The same colours and
 * radii as the site, so the paper and the page read as one thing.
 */
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
    info: {
      Title: `${t.orderDone.invoice} ${order.number}`,
      Author: settings.name,
    },
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

  /* ------------------------------- the band ------------------------------ */
  const bandHeight = 96;
  doc.rect(0, 0, PAGE.width, bandHeight).fill(BRAND);
  // The mark: four squares, one of them the deeper red, as the site's own.
  const mark = { x: left, y: 30, size: 36, gap: 3 };
  const cell = (mark.size - mark.gap) / 2;
  for (const [i, j] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    doc
      .rect(
        mark.x + i * (cell + mark.gap),
        mark.y + j * (cell + mark.gap),
        cell,
        cell,
      )
      .fill(i === 1 && j === 0 ? BRAND_DEEP : "#ffffff");
  }
  doc
    .font("bold")
    .fontSize(20)
    .fillColor("#ffffff")
    .text(settings.name, mark.x + mark.size + 12, 32);
  doc
    .font("regular")
    .fontSize(9)
    .fillColor("#ffffff")
    .text(t.orderDone.invoiceNote, mark.x + mark.size + 12, 58, {
      width: width * 0.5,
    });

  doc
    .font("bold")
    .fontSize(9)
    .fillColor("#ffd5d5")
    .text(t.orderDone.invoice, left, 28, { width, align: "right" });
  doc
    .font("bold")
    .fontSize(18)
    .fillColor("#ffffff")
    .text(order.number, left, 40, { width, align: "right" });
  doc
    .font("regular")
    .fontSize(9)
    .fillColor("#ffd5d5")
    .text(
      `${t.orderDone.issued}: ${formatDateTime(order.createdAt)}`,
      left,
      64,
      { width, align: "right" },
    );

  /* ------------------------------ two panels ----------------------------- */
  const panelTop = bandHeight + 22;
  const panelGap = 12;
  const panelWidth = (width - panelGap) / 2;
  const panelPad = 12;

  const panel = (
    x: number,
    title: string,
    lines: { text: string; strong?: boolean }[],
  ) => {
    // Measured first, drawn second: the box must be as tall as its text.
    let height = panelPad * 2 + 14;
    for (const line of lines) {
      doc.font(line.strong ? "bold" : "regular").fontSize(line.strong ? 11 : 9);
      height +=
        doc.heightOfString(line.text, { width: panelWidth - panelPad * 2 }) + 2;
    }
    doc.roundedRect(x, panelTop, panelWidth, height, 8).fill(PANEL);
    doc
      .font("bold")
      .fontSize(8)
      .fillColor(MUTED)
      .text(title, x + panelPad, panelTop + panelPad);
    let y = panelTop + panelPad + 14;
    for (const line of lines) {
      doc
        .font(line.strong ? "bold" : "regular")
        .fontSize(line.strong ? 11 : 9)
        .fillColor(line.strong ? INK : MUTED)
        .text(line.text, x + panelPad, y, { width: panelWidth - panelPad * 2 });
      y = doc.y + 2;
    }
    return height;
  };

  const zone = locale === "ka" ? order.deliveryZoneKa : order.deliveryZoneEn;
  const where =
    order.deliveryMethod === "pickup"
      ? `${t.checkout.deliveryPickup} · ${settings.pickupAddress || settings.contactAddress || settings.name}`
      : [
          t.checkout.deliveryCourier,
          zone,
          [order.city, order.address].filter(Boolean).join(", "),
        ]
          .filter(Boolean)
          .join(" · ");

  const billTo = [
    { text: order.customerName, strong: true },
    ...(order.billingCompany
      ? [{ text: order.billingCompany, strong: true }]
      : []),
    ...(order.billingTaxId
      ? [{ text: `${t.account.invoiceTaxId}: ${order.billingTaxId}` }]
      : []),
    ...[order.phone, order.email]
      .filter((line) => line.trim())
      .map((text) => ({ text })),
    { text: where },
  ];
  const paidLabel =
    order.paymentStatus === "paid"
      ? t.payment.paid
      : order.paymentStatus === "refunded"
        ? t.payment.refunded
        : t.payment.unpaid;
  // The number and the date are in the band already; this panel is how it
  // is paid and how it travels.
  const about = [
    ...(order.paymentMethod
      ? [{ text: t.payment[order.paymentMethod], strong: true }]
      : []),
    ...(order.paymentStatus
      ? [{ text: `${t.admin.paymentStatus}: ${paidLabel}` }]
      : []),
    {
      text: `${t.checkout.delivery}: ${
        order.deliveryMethod === "pickup"
          ? t.checkout.deliveryPickup
          : t.checkout.deliveryCourier
      }${zone ? ` · ${zone}` : ""}`,
    },
    {
      text: `${t.cart.item}: ${order.items.reduce((sum, item) => sum + item.quantity, 0)}`,
    },
  ];

  const h1 = panel(left, t.orderDone.billTo, billTo);
  const h2 = panel(left + panelWidth + panelGap, t.checkout.payment, about);
  doc.y = panelTop + Math.max(h1, h2) + 22;

  /* -------------------------------- lines ------------------------------- */
  const columns = {
    name: { x: left + 10, width: width * 0.5 - 10 },
    qty: { x: left + width * 0.52, width: width * 0.1 },
    price: { x: left + width * 0.64, width: width * 0.17 },
    total: { x: left + width * 0.82, width: width * 0.18 - 10 },
  };

  // A tinted header row rather than a rule: the table starts where the
  // colour starts.
  const headerY = doc.y;
  doc.roundedRect(left, headerY, width, 22, 6).fill(PANEL);
  doc.font("bold").fontSize(8).fillColor(MUTED);
  doc.text(t.cart.item, columns.name.x, headerY + 7, {
    width: columns.name.width,
  });
  doc.text(t.returns.quantity, columns.qty.x, headerY + 7, {
    width: columns.qty.width,
    align: "right",
  });
  doc.text(t.cart.price, columns.price.x, headerY + 7, {
    width: columns.price.width,
    align: "right",
  });
  doc.text(t.cart.subtotal, columns.total.x, headerY + 7, {
    width: columns.total.width,
    align: "right",
  });
  doc.y = headerY + 22;

  for (const item of order.items) {
    const rowY = doc.y + 8;
    doc.font("regular").fontSize(10).fillColor(INK);
    doc.text(name(item), columns.name.x, rowY, { width: columns.name.width });
    const nameBottom = doc.y;
    if (item.variantLabel || item.sku) {
      doc.font("regular").fontSize(8).fillColor(MUTED);
      doc.text(
        [item.variantLabel, item.sku].filter(Boolean).join(" · "),
        columns.name.x,
        nameBottom + 1,
        {
          width: columns.name.width,
        },
      );
    }
    const rowBottom = doc.y;

    doc.font("regular").fontSize(10).fillColor(INK);
    doc.text(String(item.quantity), columns.qty.x, rowY, {
      width: columns.qty.width,
      align: "right",
    });
    doc.text(money(item.price), columns.price.x, rowY, {
      width: columns.price.width,
      align: "right",
    });
    doc
      .font("bold")
      .text(money(item.price * item.quantity), columns.total.x, rowY, {
        width: columns.total.width,
        align: "right",
      });

    doc.y = rowBottom + 8;
    doc
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .lineWidth(0.5)
      .strokeColor(LINE)
      .stroke();
  }

  /* -------------------------------- totals ------------------------------ */
  // Georgian labels are long — "სულ გადასახდელი" is the total — so the
  // box takes more than half the page and the label two thirds of that.
  const totalsWidth = width * 0.56;
  const totalsX = right - totalsWidth;
  const boxPad = 12;
  const labelWidth = (totalsWidth - boxPad * 2) * 0.62;
  const valueX = totalsX + boxPad + labelWidth;
  const valueWidth = totalsWidth - boxPad * 2 - labelWidth;

  const rows: {
    label: string;
    value: string;
    strong?: boolean;
    small?: boolean;
  }[] = [
    { label: t.cart.itemsTotal, value: money(order.subtotal) },
    {
      label: t.cart.shipping,
      value: order.shipping <= 0 ? t.cart.freeShipping : money(order.shipping),
    },
    ...(order.discount > 0
      ? [
          {
            label: order.couponCode
              ? `${t.cart.discount} (${order.couponCode})`
              : t.cart.discount,
            value: `−${money(order.discount)}`,
          },
        ]
      : []),
    { label: t.cart.total, value: money(order.total), strong: true },
    ...(order.taxRate > 0
      ? [
          {
            label: fill(t.cart.taxIncluded, { rate: order.taxRate }),
            value: money(order.tax || vatIncluded(order.total, order.taxRate)),
            small: true,
          },
        ]
      : []),
  ];

  // Measured, then drawn, so the box fits its rows.
  let boxHeight = boxPad * 2;
  for (const row of rows) {
    doc
      .font(row.strong ? "bold" : "regular")
      .fontSize(row.strong ? 14 : row.small ? 8 : 10);
    boxHeight +=
      Math.max(
        doc.heightOfString(row.label, { width: labelWidth }),
        row.strong ? 18 : 13,
      ) + 5;
  }
  const boxTop = doc.y + 14;
  doc.roundedRect(totalsX, boxTop, totalsWidth, boxHeight, 8).fill(PANEL);

  let y = boxTop + boxPad;
  for (const row of rows) {
    if (row.strong) {
      doc
        .moveTo(totalsX + boxPad, y)
        .lineTo(right - boxPad, y)
        .lineWidth(1)
        .strokeColor(INK)
        .stroke();
      y += 7;
    }
    doc
      .font(row.strong ? "bold" : "regular")
      .fontSize(row.strong ? 14 : row.small ? 8 : 10)
      .fillColor(row.strong ? INK : MUTED);
    doc.text(row.label, totalsX + boxPad, y, { width: labelWidth });
    const labelBottom = doc.y;
    doc.fillColor(row.strong ? INK : row.small ? MUTED : INK);
    doc.text(row.value, valueX, y, { width: valueWidth, align: "right" });
    y = Math.max(labelBottom, y + (row.strong ? 18 : 13)) + 5;
  }

  /* --------------------------------- stamp ------------------------------ */
  // Paid or not, said once more where the eye lands last, in the colours
  // the site uses for the same words.
  if (order.paymentStatus) {
    const paid = order.paymentStatus === "paid";
    const label = paid
      ? t.orderDone.paidBadge
      : order.paymentStatus === "refunded"
        ? t.orderDone.refundedBadge
        : t.orderDone.unpaidBadge;
    doc.font("bold").fontSize(10);
    const stampWidth = doc.widthOfString(label) + 28;
    const stampX = left;
    const stampY = boxTop;
    doc
      .roundedRect(stampX, stampY, stampWidth, 28, 14)
      .fill(paid ? SUCCESS_SOFT : WARNING_SOFT);
    doc
      .fillColor(paid ? SUCCESS : WARNING)
      .text(label, stampX + 14, stampY + 8);
  }

  /* ------------------------------- footer ------------------------------- */
  const footY = PAGE.height - PAGE.margin - 30;
  doc
    .moveTo(left, footY)
    .lineTo(right, footY)
    .lineWidth(0.5)
    .strokeColor(LINE)
    .stroke();
  doc
    .font("bold")
    .fontSize(9)
    .fillColor(INK)
    .text(settings.name, left, footY + 10);
  doc.font("regular").fontSize(8).fillColor(MUTED);
  const contact = [
    settings.contactAddress,
    settings.contactPhone,
    settings.contactEmail,
  ]
    .filter((line) => line.trim())
    .join("  ·  ");
  if (contact) doc.text(contact, left, footY + 10, { width, align: "right" });

  doc.end();
  return done;
}
