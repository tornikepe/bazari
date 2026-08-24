import { getI18n } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/format";

/**
 * What turns a printed order into a document.
 *
 * Printing hides the masthead, and rightly — a navigation bar is no use on a
 * sheet of paper. But it takes the shop's name with it, and an order printed
 * with no name, no address and no phone number is a list rather than an
 * invoice. This is what goes back, and only on paper: who issued it, its
 * number, its date, and who it is for.
 *
 * Every contact line is omitted when its field is empty rather than printed
 * with a dash — the same rule the contact page follows. A shop that has not
 * filled in an address yet should say nothing about addresses, not print a
 * blank one on every invoice it sends out.
 *
 * It is not a fiscal document and says so. Issuing one means a tax number and
 * a numbering scheme an accountant signs off, neither of which a demo has —
 * and a sheet of paper that *looks* like a VAT invoice and is not is worse
 * than one that plainly is not.
 */
export async function InvoiceHead({
  number,
  createdAt,
  customer,
}: {
  number: string;
  createdAt: Date;
  customer: { name: string; phone: string; email: string; city: string; address: string };
}) {
  const [{ t }, settings] = await Promise.all([getI18n(), getSettings()]);

  const shopLines = [
    settings.contactAddress,
    settings.contactPhone,
    settings.contactEmail,
  ].filter((line) => line.trim().length > 0);

  const customerLines = [
    customer.phone,
    customer.email,
    [customer.city, customer.address].filter(Boolean).join(", "),
  ].filter((line) => line.trim().length > 0);

  return (
    <header className="print-only mb-6 border-b-2 border-ink-900 pb-4">
      <div className="flex items-start justify-between gap-8">
        <div>
          <p className="text-lg font-extrabold tracking-tight text-ink-900">{settings.name}</p>
          {shopLines.map((line) => (
            <p key={line} className="text-xs text-ink-600">
              {line}
            </p>
          ))}
        </div>

        <div className="text-right">
          <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">
            {t.orderDone.invoice}
          </p>
          <p className="font-mono text-base font-bold text-ink-900">{number}</p>
          <p className="text-xs text-ink-600">
            {t.orderDone.issued}: {formatDateTime(createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-xs font-bold tracking-wider text-ink-500 uppercase">
          {t.orderDone.billTo}
        </p>
        <p className="text-sm font-semibold text-ink-900">{customer.name}</p>
        {customerLines.map((line) => (
          <p key={line} className="text-xs text-ink-600">
            {line}
          </p>
        ))}
      </div>

      <p className="mt-3 text-xs text-ink-500">{t.orderDone.invoiceNote}</p>
    </header>
  );
}
