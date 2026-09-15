import type { PaymentMethod } from "@/lib/payment";

/**
 * A small mark beside each way to pay, so the list is scanned by shape
 * before it is read: a bank's initials in its colour, PayPal's two-tone
 * name, a coin, a note, a card. Drawn here rather than loaded, so there
 * is nothing to fetch and nothing to fall back from.
 */
export function PaymentMark({ method }: { method: PaymentMethod }) {
  const box =
    "grid h-8 w-12 shrink-0 place-items-center rounded-control text-[0.6875rem] font-extrabold tracking-tight";
  switch (method) {
    case "tbc":
      return (
        <span className={`${box} bg-[#00a3e0] text-white`} aria-hidden>
          TBC
        </span>
      );
    case "bog":
      return (
        <span className={`${box} bg-[#ff5b00] text-white`} aria-hidden>
          BOG
        </span>
      );
    case "paypal":
      return (
        <span className={`${box} bg-[#003087] text-white`} aria-hidden>
          <span>
            Pay<span className="text-[#009cde]">Pal</span>
          </span>
        </span>
      );
    case "crypto":
      return (
        <span
          className={`${box} bg-[#f7931a] text-base text-white`}
          aria-hidden
        >
          ₿
        </span>
      );
    case "card":
      return (
        <span className={`${box} bg-ink-900 text-surface`} aria-hidden>
          <svg
            width="22"
            height="16"
            viewBox="0 0 22 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <rect x="1" y="1" width="20" height="14" rx="2.5" />
            <path d="M1 6h20" />
          </svg>
        </span>
      );
    case "bank_transfer":
      return (
        <span className={`${box} bg-ink-100 text-ink-700`} aria-hidden>
          <svg
            width="18"
            height="16"
            viewBox="0 0 18 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          >
            <path d="M1 6l8-5 8 5H1z" />
            <path d="M3 6v6M7.5 6v6M10.5 6v6M15 6v6M1 15h16" />
          </svg>
        </span>
      );
    default:
      return (
        <span
          className={`${box} bg-success-soft text-success text-sm`}
          aria-hidden
        >
          ₾
        </span>
      );
  }
}
