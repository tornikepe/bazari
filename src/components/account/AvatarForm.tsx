"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { removeAvatar, updateAvatar } from "@/app/actions/account";
import { initialsOf } from "@/components/account/initials";
import { Busy, Swap } from "@/components/ui/Swap";
import { CameraIcon, CheckIcon, TrashIcon } from "@/components/ui/icons";
import { MAX_BYTES } from "@/lib/image-upload";
import { shrinkImage } from "@/lib/shrink-image";

/**
 * The customer's picture: what it is now, a way to pick another, a way to
 * take it off. The file goes up the moment it is chosen — a "save" button
 * between choosing a photo and seeing it is a step nobody wants — and the
 * page refreshes so the header and the identity card show the new one.
 */
export function AvatarForm({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "saved" | "too-large" | "not-an-image" | "failed"
  >("idle");

  function upload(original: File) {
    setStatus("idle");
    startTransition(async () => {
      /* Shrunk here, before it leaves the browser. A phone's photo is four
         to eight megabytes, and the request that carried it was refused
         at one — not by the size check in the action, which never ran,
         but by the server in front of it, so the page showed a crash
         where it meant to show "too large". A 512px square is every size
         this picture is ever drawn at, and weighs fifty kilobytes. */
      const file = await shrinkImage(original, { side: 512, square: true });
      if (file.size > MAX_BYTES) {
        setStatus("too-large");
        return;
      }

      const formData = new FormData();
      formData.set("avatar", file);
      try {
        const result = await updateAvatar(formData);
        if (!result.ok) {
          setStatus(
            result.error === "too-large"
              ? "too-large"
              : result.error === "not-an-image"
                ? "not-an-image"
                : "failed",
          );
          return;
        }
      } catch {
        // The request itself failed — the network, or a body the server
        // would not take. A message on the page, not an error page.
        setStatus("failed");
        return;
      }
      setStatus("saved");
      router.refresh();
    });
  }

  function remove() {
    setStatus("idle");
    startTransition(async () => {
      const result = await removeAvatar();
      setStatus(result.ok ? "saved" : "failed");
      router.refresh();
    });
  }

  return (
    <section className="mb-7 border-b border-line pb-6">
      {/* One row: the picture, what the card is for, and the buttons at the
          far end. The picture is the subject, so it comes first and the
          heading stands beside it rather than above a card that is mostly
          empty space around a square. */}
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-4 sm:text-left">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-card object-cover ring-1 ring-line"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-20 w-20 shrink-0 place-items-center rounded-card bg-brand-solid text-2xl font-extrabold tracking-tight text-brand-on-solid"
          >
            {initialsOf(name, email)}
          </span>
        )}

        <div className="min-w-0 sm:min-w-48 sm:flex-1">
          <h2 className="text-sm font-bold text-ink-900">{t.account.photo}</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            {t.account.photoHint}
          </p>
        </div>

        {/* Two equal halves on a phone rather than two buttons of their own
            widths stacked — from `sm` up they take their own width and sit
            at the row's end. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => input.current?.click()}
            className="btn btn-primary btn-md flex-1 sm:flex-none"
          >
            <Swap
              show={
                isPending ? (
                  <Busy label={t.account.photoChoose} />
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <CameraIcon size={16} />
                    {t.account.photoChoose}
                  </span>
                )
              }
              of={[
                <span key="choose" className="inline-flex items-center gap-2">
                  <CameraIcon size={16} />
                  {t.account.photoChoose}
                </span>,
              ]}
            />
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={isPending}
              onClick={remove}
              className="btn btn-outline btn-md flex-1 text-danger hover:bg-danger-soft sm:flex-none"
            >
              <TrashIcon size={16} />
              {t.account.photoRemove}
            </button>
          )}
        </div>
      </div>

      {status !== "idle" && (
        <p
          role="status"
          className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${
            status === "saved" ? "text-success" : "text-danger"
          }`}
        >
          {status === "saved" && <CheckIcon size={16} />}
          {status === "saved"
            ? t.account.photoSaved
            : status === "too-large"
              ? t.account.photoTooLarge
              : status === "not-an-image"
                ? t.account.photoNotImage
                : t.account.photoFailed}
        </p>
      )}
    </section>
  );
}
