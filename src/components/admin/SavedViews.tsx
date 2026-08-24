"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { CloseIcon, SpinnerIcon } from "@/components/ui/icons";
import { saveView, deleteView } from "@/app/actions/views";
import type { SavedViewPage } from "@/lib/saved-views";
import { fill } from "@/lib/i18n";

/**
 * The listings somebody comes back to, as a row of chips.
 *
 * A view is the query string the toolbar already produces, with a name on it.
 * Nothing else — no second filter model to keep in step with the controls, and
 * a view that keeps working when a new filter is added, because it was only
 * ever a URL.
 *
 * The chips are links. That matters more than it sounds: a saved view opens in
 * a new tab, gets bookmarked, and can be sent to somebody — all of which a
 * button that pushed state could not do.
 *
 * Saving is offered to anyone who can read the page, including a viewer: a
 * shortcut to a listing is not a change to the shop, and read-only staff have
 * the most use for one.
 */
export function SavedViews({
  page,
  views,
  className = "",
}: {
  page: SavedViewPage;
  views: { id: string; name: string; query: string }[];
  className?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  /* Without `page`, which is the pagination cursor and not part of what a view
     is: "unpaid, biggest first" is the view, and page four of it is where the
     reader happened to be standing. */
  const current = (() => {
    const search = new URLSearchParams(params.toString());
    search.delete("page");
    return search.toString();
  })();

  function save() {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    setError(null);
    startTransition(async () => {
      const result = await saveView(page, trimmed, current);

      if (!result.ok) {
        setError(result.error === "too-many" ? t.admin.viewsTooMany : t.common.error);
        return;
      }

      setNaming(false);
      setName("");
      router.refresh();
    });
  }

  if (views.length === 0 && !naming) {
    return (
      <div className={className}>
        <SaveButton onClick={() => setNaming(true)} label={t.admin.viewsSave} />
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {views.map((view) => {
        const active = view.query === current;
        return (
          <span
            key={view.id}
            className={`inline-flex items-center gap-1 rounded-pill border px-1 py-0.5 text-xs ${
              active
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-line text-ink-600 hover:border-ink-300"
            }`}
          >
            <Link
              href={view.query ? `${pathname}?${view.query}` : pathname}
              aria-current={active ? "true" : undefined}
              className="px-1.5 font-semibold"
            >
              {view.name}
            </Link>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  await deleteView(view.id);
                  router.refresh();
                });
              }}
              aria-label={fill(t.admin.viewsDelete, { name: view.name })}
              className="grid h-5 w-5 place-items-center rounded-pill text-ink-400 hover:text-danger"
            >
              <CloseIcon size={12} />
            </button>
          </span>
        );
      })}

      {naming ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                save();
              }
              if (event.key === "Escape") {
                setNaming(false);
                setName("");
                setError(null);
              }
            }}
            aria-label={t.admin.viewsName}
            placeholder={t.admin.viewsName}
            className="field h-8 w-44 px-2 text-sm"
          />
          <button
            type="button"
            onClick={save}
            disabled={isPending || name.trim().length === 0}
            className="btn btn-outline btn-sm"
          >
            {isPending && <SpinnerIcon size={14} />}
            {t.admin.viewsSave}
          </button>
          <button
            type="button"
            onClick={() => {
              setNaming(false);
              setName("");
              setError(null);
            }}
            className="btn btn-ghost btn-sm"
          >
            {t.admin.viewsCancel}
          </button>
        </span>
      ) : (
        <SaveButton onClick={() => setNaming(true)} label={t.admin.viewsSave} />
      )}

      {error && (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

function SaveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-semibold text-ink-500 underline decoration-dotted underline-offset-4 hover:text-brand-600"
    >
      {label}
    </button>
  );
}
