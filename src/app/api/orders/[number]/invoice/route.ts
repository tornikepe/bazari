import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readReceipts } from "@/lib/order-access";
import { getLocale } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/**
 * The order as a PDF, for download.
 *
 * Who may have it is exactly who may see the order page: the customer it
 * belongs to, a staff member, or the browser that placed it and still holds
 * the receipt cookie. Anyone else gets a 404 rather than a 403 — an order
 * number is guessable, and "forbidden" would confirm the guess.
 *
 * Rendered on request rather than stored: the PDF is a function of the
 * order's own columns, which were snapshotted when it was placed, so it comes
 * out the same every time and there is nothing to keep in sync.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;

  const order = await prisma.order.findUnique({
    where: { number: decodeURIComponent(number) },
    include: { items: true, coupon: { select: { code: true } } },
  });
  if (!order) return new NextResponse(null, { status: 404 });

  const [user, receipts] = await Promise.all([getCurrentUser(), readReceipts()]);
  const mayView =
    (user !== null && (user.role === "admin" || user.role === "viewer")) ||
    (order.userId !== null && order.userId === user?.id) ||
    receipts.includes(order.number);
  if (!mayView) return new NextResponse(null, { status: 404 });

  const [settings, locale] = await Promise.all([getSettings(), getLocale()]);
  const pdf = await renderInvoicePdf(
    {
      ...order,
      couponCode: order.coupon?.code ?? null,
      items: order.items.map((item) => ({
        nameKa: item.nameKa,
        nameEn: item.nameEn,
        variantLabel: item.variantLabel,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
      })),
    },
    settings,
    locale,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.number}.pdf"`,
      "Content-Length": String(pdf.byteLength),
      // A receipt, for one person: never shared by a cache.
      "Cache-Control": "private, no-store",
    },
  });
}
