import { getI18n } from "@/lib/locale";
import { getAllPagesForEditing } from "@/lib/info-store";
import { PageEditor } from "@/components/admin/PageEditor";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { PageHeader } from "@/components/layout/PageHeader";

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

      <PageHeader scale="panel" title={t.admin.pages} lead={t.admin.pagesHint} />

      <div className="mt-5 flex flex-col gap-4">
        {pages.map((page) => (
          <PageEditor key={page.slug} page={page} />
        ))}
      </div>
    </div>
  );
}
