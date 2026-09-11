import { getI18n } from "@/lib/locale";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { ReadOnlyNotice } from "@/components/admin/ReadOnlyNotice";
import { PageHeader } from "@/components/layout/PageHeader";
import { DeliveryZones } from "@/components/admin/DeliveryZones";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

/**
 * Everything about the shop that is not a product.
 *
 * This page is the answer to "can somebody else use this?". Before it, the
 * shop's name, its delivery rules and its contact details were constants in
 * TypeScript, so adopting the project meant editing source — which is another
 * way of saying it could not be adopted at all.
 */
export default async function SettingsPage() {
  const [{ locale, t }, settings, zones] = await Promise.all([
    getI18n(),
    getSettings(),
    // Every zone, switched off ones included: this is where they are managed.
    prisma.deliveryZone.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <ReadOnlyNotice />

      <PageHeader scale="panel" title={t.admin.settings} lead={t.admin.settingsHint} />

      <SettingsForm settings={settings} />

      {/* Its own card below the form rather than a section inside it: the
          zones are a list with their own add, edit and delete, and a list
          inside a form is a form inside a form. */}
      <section className="card mt-4 card-pad">
        <h2 className="text-sm font-bold text-ink-900">{t.admin.deliveryZones}</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">{t.admin.deliveryZonesHint}</p>
        <div className="mt-4">
          <DeliveryZones
            zones={zones.map((zone) => ({
              id: zone.id,
              nameKa: zone.nameKa,
              nameEn: zone.nameEn,
              fee: zone.fee,
              freeAbove: zone.freeAbove,
              feeLabel: formatPrice(zone.fee, locale),
              freeAboveLabel:
                zone.freeAbove !== null ? formatPrice(zone.freeAbove, locale) : null,
              sortOrder: zone.sortOrder,
              isActive: zone.isActive,
            }))}
          />
        </div>
      </section>
    </div>
  );
}
