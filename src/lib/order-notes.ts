import { fill, type Dictionary, type Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/format";

/**
 * What the one-line note on an order event says, in the reader's language.
 *
 * The notes used to be English sentences written straight into the column —
 * "Payment marked received by admin@luto.ge" — which was fine while nobody
 * displayed them and wrong the moment somebody did: this shop's staff read
 * Georgian. So the column now holds a key, and the sentence is made here.
 *
 * Anything that is not a key is handed back as it stands. Orders placed
 * before this existed still carry their English sentence, and a sentence in
 * the wrong language is better than a blank row where an explanation was.
 */
export function orderNoteText(note: string, t: Dictionary, locale: Locale): string {
  if (!note) return "";
  if (note === "order-placed") return t.admin.noteOrderPlaced;
  if (note === "payment-received") return t.admin.notePaymentReceived;

  const refunded = /^refunded:(\d+)$/.exec(note);
  if (refunded) {
    return fill(t.admin.noteRefunded, { amount: formatPrice(Number(refunded[1]), locale) });
  }

  return note;
}

/**
 * The same, for the one-line note on a stock movement.
 *
 * The ledger already says what kind of movement it was; the note says which
 * order or refund caused it, and it was written in English for the same
 * reason and with the same consequence.
 */
export function stockNoteText(note: string, t: Dictionary, locale: Locale): string {
  if (!note) return "";
  if (note === "order-cancelled") return t.admin.noteOrderCancelled;
  if (note === "customer-return") return t.admin.noteCustomerReturn;

  const refunded = /^refunded:(\d+)$/.exec(note);
  if (refunded) {
    return fill(t.admin.noteRefunded, { amount: formatPrice(Number(refunded[1]), locale) });
  }

  return note;
}
