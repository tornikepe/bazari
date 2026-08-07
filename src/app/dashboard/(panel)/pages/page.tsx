import { getI18n } from "@/lib/locale";
import { getAllPagesForEditing } from "@/lib/info-store";
import { PageEditor } from "@/components/admin/PageEditor";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";

/**
 * The footer's information pages, editable.
 *
 * All eight on one screen rather than a list that navigates into each: they
 * are short, they are edited rarely, and comparing "what does the returns page
 * say" against "what does the warranty page say" is the common reason to open
 * this at all.
 */
export default async function PagesAdminPage() {
  const [{ t }, pages] = await Promise.all([getI18n(), getAllPagesForEditing()]);

  return (
    <div className="mx-auto max-w-5xl">
      <ReadOnlyNotice />

      <h1 className="text-xl font-extrabold tracking-tight text-ink-900">{t.admin.pages}</h1>
      <p className="mt-1 text-sm text-ink-500">{t.admin.pagesHint}</p>

      <div className="mt-5 flex flex-col gap-4">
        {pages.map((page) => (
          <PageEditor key={page.slug} page={page} />
        ))}
      </div>
    </div>
  );
}
