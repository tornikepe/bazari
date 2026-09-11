import { getI18n } from "@/lib/locale";
import { DEFAULT_RANGE, isRangeDays } from "@/lib/analytics";
import { getTraffic } from "@/lib/traffic";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChartRangeTabs } from "@/components/admin/ChartRangeTabs";
import { SalesChart } from "@/components/admin/SalesChart";
import { Figures } from "@/components/ui/Figures";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyOrdersArt } from "@/components/ui/illustrations";
import type { RawSearchParams } from "@/lib/filters";

/**
 * How many people came, and where they went.
 *
 * Every figure here is a count from `PageView` and `DailyVisitor` — see
 * `lib/traffic.ts` for what those hold, which is numbers and a hash that
 * cannot be turned back into a person. The page says so at the top, because
 * an analytics page that does not say what it is counting invites the
 * assumption that it is counting everything.
 */
export default async function TrafficPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const { locale, t } = await getI18n();
  const params = await searchParams;
  const rangeRaw = Number(Array.isArray(params.range) ? params.range[0] : params.range);
  const range = isRangeDays(rangeRaw) ? rangeRaw : DEFAULT_RANGE;

  const report = await getTraffic(range);
  const perVisitor = report.visitors > 0 ? report.views / report.visitors : 0;
  const count = new Intl.NumberFormat(locale === "ka" ? "ka-GE" : "en-GB");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader scale="panel" title={t.admin.traffic} lead={t.admin.trafficHint} />

      {report.views === 0 ? (
        <EmptyState
          className="card mt-4"
          art={<EmptyOrdersArt size={88} />}
          title={t.admin.trafficNone}
          text={t.admin.trafficNoneHint}
          titleAs="p"
        />
      ) : (
        <>
          <Figures
            className="mt-4"
            columns={3}
            items={[
              { label: t.admin.trafficViews, value: count.format(report.views) },
              { label: t.admin.trafficVisitors, value: count.format(report.visitors) },
              { label: t.admin.trafficPerVisitor, value: perVisitor.toFixed(1) },
            ]}
          />
          <p className="mt-2 text-xs text-ink-400">{t.admin.trafficVisitorsHint}</p>

          <section className="card mt-4 card-pad">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-ink-900">{t.admin.trafficChart}</h2>
              <ChartRangeTabs active={range} t={t} basePath="/dashboard/traffic" />
            </div>

            {/* The sales chart, told to speak in counts: same bars, same
                scale, same axis, and none of the money. */}
            <SalesChart
              data={report.daily.map((day) => ({ date: day.date, total: day.views }))}
              locale={locale}
              t={t}
              voice={{
                format: (value) => count.format(value),
                nothing: t.admin.trafficNoViews,
                empty: t.admin.trafficNone,
                labels: {
                  total: t.admin.trafficViews,
                  average: t.admin.trafficAverage,
                  peak: t.admin.trafficPeak,
                },
              }}
            />
          </section>

          <section className="card mt-4 overflow-hidden">
            <h2 className="card-head text-sm font-bold text-ink-900">{t.admin.trafficPages}</h2>
            <ol className="divide-y divide-line">
              {report.pages.map((page, index) => {
                const share = report.views > 0 ? (page.views / report.views) * 100 : 0;
                return (
                  <li key={page.path} className="relative flex items-center gap-3 px-5 py-2.5 text-sm">
                    {/* The share of all views, drawn behind the row: the list
                        reads as a chart without being one. */}
                    <span
                      aria-hidden="true"
                      style={{ width: `${share}%` }}
                      className="absolute inset-y-0 left-0 bg-brand-50"
                    />
                    <span className="relative w-6 shrink-0 font-mono text-xs text-ink-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="relative min-w-0 flex-1 truncate font-mono text-xs text-ink-800">
                      {page.path}
                    </span>
                    <span className="relative shrink-0 text-xs font-bold text-ink-900 tabular-nums">
                      {count.format(page.views)}
                    </span>
                    <span className="relative w-12 shrink-0 text-right text-xs text-ink-400 tabular-nums">
                      {share.toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
