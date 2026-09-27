"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/providers/I18nProvider";
import { AlertIcon, CameraIcon, CheckIcon, TrashIcon } from "@/components/ui/icons";
import { shrinkImage } from "@/lib/shrink-image";

/** A slip at 1600px is legible and weighs a few hundred kilobytes. */
const SIDE = 1600;
const MAX_BYTES = 2_000_000;

/**
 * The photograph of the transfer, asked for before a bank-transfer order
 * can be placed.
 *
 * The shop has no gateway telling it money arrived; the slip is the only
 * evidence it will ever have. Without it an order paid this way is a
 * promise, and a shop that takes those spends its week chasing people who
 * pressed the button and never paid — which is what "make it required so
 * they don't press order for nothing" means.
 *
 * Shrunk here rather than sent whole: a phone's photograph is four to
 * eight megabytes, and the server in front of the action refuses a request
 * that large with an error that looks like a crash.
 */
export function ReceiptUpload({
  file,
  onPick,
  invalid,
}: {
  file: File | null;
  onPick: (file: File | null) => void;
  /** The order was refused because this is missing. */
  invalid: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  /* The preview is made from the file during render and released when the
     file changes — deriving it in an effect meant a state write after every
     pick and a first paint with no picture in it. The pair is held
     together, `file` included, so the comparison below settles in one
     render: `null !== null` is false, and nothing loops. */
  const [made, setMade] = useState<{ file: File | null; url: string | null }>({
    file: null,
    url: null,
  });
  if (made.file !== file) {
    /* The old url is let go by the effect below, not here: revoking during
       render can blank the picture that is still on screen for a frame. */
    setMade({ file, url: file ? URL.createObjectURL(file) : null });
  }
  const preview = made.file === file ? made.url : null;

  /* And released for good when the control goes away — or when the url
     changes, which the swap above has already handled by then, so the
     cleanup only ever has the last one left to let go of. */
  useEffect(() => {
    const url = made.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [made.url]);

  async function take(original: File) {
    setFailed(null);
    setBusy(true);
    try {
      const small = await shrinkImage(original, { side: SIDE });
      if (small.size > MAX_BYTES) {
        setFailed(t.checkout.receiptTooLarge);
        return;
      }
      onPick(small);
    } catch {
      setFailed(t.checkout.receiptFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="checkout-receipt" className={`receipt-box ${invalid ? "is-bad" : ""}`}>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
        className="sr-only"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          if (chosen) void take(chosen);
          event.target.value = "";
        }}
      />

      <div className="receipt-head">
        <span className="receipt-mark" aria-hidden="true">
          {file ? <CheckIcon size={16} strokeWidth={3} /> : <CameraIcon size={16} />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink-900">
            {t.checkout.receiptTitle}
            <span className="ml-0.5 text-brand-600">*</span>
          </p>
          <p className="mt-0.5 text-xs leading-snug text-ink-500">{t.checkout.receiptHint}</p>
        </div>
      </div>

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="receipt-shot" />
      )}

      <div className="receipt-actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="btn btn-outline btn-sm"
        >
          <CameraIcon size={14} />
          {busy ? t.checkout.receiptWorking : file ? t.checkout.receiptReplace : t.checkout.receiptPick}
        </button>

        {file && !busy && (
          <button
            type="button"
            onClick={() => onPick(null)}
            className="btn btn-ghost btn-sm text-ink-500 hover:text-danger"
          >
            <TrashIcon size={14} />
            {t.checkout.receiptRemove}
          </button>
        )}
      </div>

      {(failed || invalid) && (
        <p role="alert" className="receipt-fault">
          <AlertIcon size={14} className="shrink-0" />
          {failed ?? t.checkout.receiptRequired}
        </p>
      )}
    </div>
  );
}
