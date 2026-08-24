import { getI18n } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * Everything about the shop that is not a product.
 *
 * This page is the answer to "can somebody else use this?". Before it, the
 * shop's name, its delivery rules and its contact details were constants in
 * TypeScript, so adopting the project meant editing source — which is another
 * way of saying it could not be adopted at all.
 */
export default async function SettingsPage() {
  const [{ t }, settings] = await Promise.all([getI18n(), getSettings()]);

  return (
    <div className="mx-auto max-w-3xl">
      <ReadOnlyNotice />

      <PageHeader scale="panel" title={t.admin.settings} lead={t.admin.settingsHint} />

      <SettingsForm settings={settings} />
    </div>
  );
}
