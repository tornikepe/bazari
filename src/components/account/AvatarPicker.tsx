"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { removeAvatar, updateAvatar } from "@/app/actions/account";
import { CameraIcon, SpinnerIcon, TrashIcon } from "@/components/ui/icons";
import { shrinkImage } from "@/lib/shrink-image";
import { initialsOf } from "@/components/account/initials";

const MAX_BYTES = 1_000_000;

/**
 * The customer's picture, at the head of the account's menu, and the way
 * to change it: the picture itself is the button. Pressing it opens the
 * file chooser; a picture already set can be taken off with the small
 * cross at its corner.
 *
 * The file is shrunk in the browser before it leaves — a phone's photo is
 * four to eight megabytes and the request that carried it was refused by
 * the server in front of the action, which showed a crash where it meant
 * to say "too large". A 512px square is every size this picture is drawn
 * at, and weighs fifty kilobytes.
 */
export function AvatarPicker({
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
  const [failed, setFailed] = useState<string | null>(null);

  function upload(original: File) {
    setFailed(null);
    startTransition(async () => {
      const file = await shrinkImage(original, { side: 512, square: true });
      if (file.size > MAX_BYTES) {
        setFailed(t.account.photoTooLarge);
        return;
      }
      const formData = new FormData();
      formData.set("avatar", file);
      try {
        const result = await updateAvatar(formData);
        if (!result.ok) {
          setFailed(result.error === "too-large" ? t.account.photoTooLarge : t.common.error);
          return;
        }
      } catch {
        setFailed(t.common.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setFailed(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) setFailed(t.common.error);
      router.refresh();
    });
  }

  return (
    <div className="avatar-pick">
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
        aria-label={t.account.photoChoose}
        title={t.account.photoChoose}
        className="avatar-pick-button"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={96} height={96} className="avatar-pick-img" />
        ) : (
          <span aria-hidden="true" className="avatar-pick-initials">
            {initialsOf(name, email)}
          </span>
        )}

        {/* The camera on the picture's lower edge, so the picture reads as
            something that can be changed. A pointer gets the two words
            over the picture instead — see `.avatar-pick-over`. */}
        <span className="avatar-pick-mark" aria-hidden="true">
          {isPending ? <SpinnerIcon size={14} /> : <CameraIcon size={14} />}
        </span>
      </button>

      {avatarUrl && !isPending && (
        <button
          type="button"
          onClick={remove}
          aria-label={t.account.photoRemove}
          title={t.account.photoRemove}
          className="avatar-pick-x"
        >
          <TrashIcon size={12} />
        </button>
      )}

      {/* What a pointer sees when it rests on the picture: change it, or
          take it off. A sibling rather than something inside the picture's
          own button, because a button cannot hold buttons; it lies over
          the circle and only takes the pointer once it is shown. */}
      {!isPending && (
        <span className="avatar-pick-over">
          <button
            type="button"
            onClick={() => input.current?.click()}
            aria-label={t.account.photoChoose}
            title={t.account.photoChoose}
          >
            <CameraIcon size={15} />
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={remove}
              aria-label={t.account.photoRemove}
              title={t.account.photoRemove}
              className="is-off"
            >
              <TrashIcon size={15} />
            </button>
          )}
        </span>
      )}

      {failed && (
        <p role="alert" className="mt-2 text-center text-xs font-semibold text-danger">
          {failed}
        </p>
      )}
    </div>
  );
}
