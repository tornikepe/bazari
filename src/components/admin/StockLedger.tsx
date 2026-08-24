import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getI18n } from "@/lib/locale";
import { formatDateTime } from "@/lib/format";

/**
 * The append-only stock ledger for one product.
 *
 * Every write that changes `stock` also appends a row here with the resulting
 * balance, so this table explains exactly how the product reached its current
 * level — that's the whole point of keeping the ledger.
 */
export async function StockLedger({ productId }: { productId: string }) {
  const { t } = await getI18n();

  const movements = await prisma.stockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { order: { select: { id: true, number: true } } },
  });

  return (
    <section className="card mt-4 overflow-hidden">
      <div className="card-head">
        <h2 className="text-sm font-bold text-ink-900">{t.admin.stockLedger}</h2>
        <p className="mt-0.5 text-xs text-ink-500">{t.admin.stockLedgerHint}</p>
      </div>

      {movements.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-500">{t.admin.noStockMovements}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table text-xs">
            <thead>
              <tr>
                <th>{t.admin.stockLedger}</th>
                <th className="figures">±</th>
                <th className="figures">{t.admin.stockBalance}</th>
                <th className="figures">{t.admin.orders}</th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td>
                    <p className="font-semibold text-ink-800">
                      {t.stockReason[movement.reason]}
                    </p>
                    <p className="mt-0.5 text-ink-400">{formatDateTime(movement.createdAt)}</p>
                  </td>

                  <td
                    className={`figures font-mono font-bold ${
                      movement.delta < 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {movement.delta > 0 ? `+${movement.delta}` : movement.delta}
                  </td>

                  <td className="figures font-mono font-semibold text-ink-800">
                    {movement.balance}
                  </td>

                  <td className="figures">
                    {movement.order ? (
                      <Link
                        href={`/dashboard/orders/${movement.order.id}`}
                        className="font-mono font-semibold text-brand-600 hover:underline"
                      >
                        {movement.order.number}
                      </Link>
                    ) : (
                      <span className="text-ink-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
