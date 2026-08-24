"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { savePage } from "@/app/actions/pages";
import { AlertIcon, CheckIcon, SpinnerIcon } from "@/components/ui/icons";

export type EditablePage = {
  slug: string;
  titleKa: string;
  titleEn: string;
  introKa: string;
  introEn: string;
  bodyKa: string;
  bodyEn: string;
  isPublished: boolean;
};

/**
 * One information page, both languages side by side.
 *
 * Side by side rather than behind a language tab: these are translations of
 * each other, and the mistake worth preventing is editing one and forgetting
 * the other. Seeing the gap is the point.
 */
export function PageEditor({ page }: { page: EditablePage }) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await savePage(formData);
      setStatus(result.ok ? "saved" : "error");
      if (result.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="card card-pad">
      <input type="hidden" name="slug" value={page.slug} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-bold text-ink-900">/{page.slug}</h2>

        <label className="flex items-center gap-2 text-xs text-ink-600">
          <input
            type="checkbox"
            name="isPublished"
            defaultChecked={page.isPublished}
            disabled={!canWrite}
            className="h-4 w-4"
          />
          {t.admin.pagePublished}
        </label>
      </div>

      <p className="mt-1 text-xs text-ink-400">{t.admin.pageHiddenNote}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Column
          suffix="Ka"
          lang="ქართული"
          page={page}
          disabled={!canWrite}
          labels={t.admin}
        />
        <Column suffix="En" lang="English" page={page} disabled={!canWrite} labels={t.admin} />
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="text-xs leading-relaxed text-ink-500">{t.admin.pageFormatHint}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">{t.admin.pagePlaceholderHint}</p>
      </div>

      {canWrite && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isPending} className="btn btn-primary btn-sm">
            {isPending && <SpinnerIcon size={15} />}
            {isPending ? t.admin.saving : t.admin.save}
          </button>

          {status === "saved" && !isPending && (
            <p role="status" className="flex items-center gap-1.5 text-xs text-success">
              <CheckIcon size={14} />
              {t.admin.settingsSaved}
            </p>
          )}

          {status === "error" && !isPending && (
            /* Two sentences rather than one: the second is the one nobody was
               told — that the page they are looking at still holds everything
               they typed, so pressing save again is all this needs. */
            <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
              <AlertIcon size={14} className="mt-px shrink-0" />
              <span>
                {t.admin.settingsInvalid} <span className="text-ink-600">{t.common.errorHint}</span>
              </span>
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function Column({
  suffix,
  lang,
  page,
  disabled,
  labels,
}: {
  suffix: "Ka" | "En";
  lang: string;
  page: EditablePage;
  disabled: boolean;
  labels: { pageTitle: string; pageIntro: string; pageBody: string };
}) {
  const title = suffix === "Ka" ? page.titleKa : page.titleEn;
  const intro = suffix === "Ka" ? page.introKa : page.introEn;
  const body = suffix === "Ka" ? page.bodyKa : page.bodyEn;
  const id = (field: string) => `${page.slug}-${field}${suffix}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="label text-ink-500">{lang}</p>

      <div>
        <label className="field-label" htmlFor={id("title")}>
          {labels.pageTitle}
        </label>
        <input
          id={id("title")}
          name={`title${suffix}`}
          defaultValue={title}
          disabled={disabled}
          className="field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor={id("intro")}>
          {labels.pageIntro}
        </label>
        <textarea
          id={id("intro")}
          name={`intro${suffix}`}
          defaultValue={intro}
          disabled={disabled}
          rows={2}
          className="field"
        />
      </div>

      <div>
        <label className="field-label" htmlFor={id("body")}>
          {labels.pageBody}
        </label>
        <textarea
          id={id("body")}
          name={`body${suffix}`}
          defaultValue={body}
          disabled={disabled}
          rows={12}
          // Monospace so `## ` lines are visibly different from paragraphs,
          // which is the whole of the format the owner has to understand.
          className="field font-mono text-xs leading-relaxed"
        />
      </div>
    </div>
  );
}
