"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/providers/I18nProvider";
import { useCanWrite } from "@/components/admin/StaffRoleProvider";
import { ErrorNote } from "@/components/ui/ErrorNote";
import { CloseIcon, PlusIcon, SpinnerIcon } from "@/components/ui/icons";
import { saveVariants, type OptionInput, type VariantInput } from "@/app/actions/variants";
import { combinations } from "@/lib/variants";

/**
 * Where the shop says it sells a thing in more than one form.
 *
 * The questions are typed; the combinations are not. Three sizes and two
 * colours is six rows, and asking somebody to enter six rows to say "six" is
 * how a variants editor becomes the part of the dashboard nobody uses.
 *
 * A row is identified by the answers it is made of, never by its position. So
 * inserting "M" between "S" and "L" moves five rows down the table and none of
 * them lose the stock figure typed into them — which is the difference between
 * an editor somebody trusts and one they retype from scratch every time.
 *
 * Values added in this session carry a temporary id until the save gives them
 * a real one. The server maps the two, so a stock figure typed against a size
 * that did not exist a minute ago still lands on it.
 */

type ValueDraft = { id: string; valueKa: string; valueEn: string; isNew?: boolean };
type OptionDraft = { id: string; nameKa: string; nameEn: string; isNew?: boolean; values: ValueDraft[] };
type RowDraft = { sku: string; price: string; stock: number; isActive: boolean };

let counter = 0;
const tempId = () => `new-${++counter}`;

export function VariantsPanel({
  productId,
  options: saved,
  variants: savedVariants,
}: {
  productId: string;
  options: { id: string; nameKa: string; nameEn: string; values: ValueDraft[] }[];
  variants: { valueIds: string[]; sku: string; price: number | null; stock: number; isActive: boolean }[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const canWrite = useCanWrite();
  const [isPending, startTransition] = useTransition();

  const [options, setOptions] = useState<OptionDraft[]>(() =>
    saved.map((option) => ({ ...option, values: option.values.map((value) => ({ ...value })) })),
  );

  /** Typed figures, keyed by the combination rather than by position. */
  const [rows, setRows] = useState<Record<string, RowDraft>>(() =>
    Object.fromEntries(
      savedVariants.map((variant) => [
        keyOf(variant.valueIds),
        {
          sku: variant.sku,
          price: variant.price === null ? "" : String(variant.price / 100),
          stock: variant.stock,
          isActive: variant.isActive,
        },
      ]),
    ),
  );

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!canWrite) return null;

  /* Only questions with a name and at least one answer take part. A half-typed
     row is somebody mid-thought, not a question the shop is asking. */
  const usable = options.filter(
    (option) =>
      option.nameKa.trim() &&
      option.nameEn.trim() &&
      option.values.some((value) => value.valueKa.trim() && value.valueEn.trim()),
  );

  const grid = combinations(
    usable.map((option) => ({
      id: option.id,
      name: option.nameEn,
      values: option.values
        .filter((value) => value.valueKa.trim() && value.valueEn.trim())
        .map((value) => ({ id: value.id, label: value.valueEn })),
    })),
  ).filter((row) => row.length > 0);

  const labelOf = (valueIds: string[]) =>
    valueIds
      .map(
        (id) =>
          usable
            .flatMap((option) => option.values)
            .find((value) => value.id === id)?.valueEn ?? "",
      )
      .filter(Boolean)
      .join(" · ");

  const rowFor = (valueIds: string[]): RowDraft =>
    rows[keyOf(valueIds)] ?? { sku: "", price: "", stock: 0, isActive: true };

  function setRow(valueIds: string[], patch: Partial<RowDraft>) {
    const key = keyOf(valueIds);
    setDone(false);
    setRows((current) => ({ ...current, [key]: { ...rowFor(valueIds), ...patch } }));
  }

  function save() {
    setError(null);
    setDone(false);

    /* Every id goes, temporary ones included. The server tells them apart by
       looking them up — a temporary id matches nothing and is created — and it
       needs to see them, because the rows underneath refer to a freshly added
       size by exactly that id. Sending `undefined` instead is what made every
       new combination arrive as one nobody had typed a stock figure for. */
    const payload: OptionInput[] = usable.map((option) => ({
      id: option.id,
      nameKa: option.nameKa,
      nameEn: option.nameEn,
      values: option.values
        .filter((value) => value.valueKa.trim() && value.valueEn.trim())
        .map((value) => ({
          id: value.id,
          valueKa: value.valueKa,
          valueEn: value.valueEn,
        })),
    }));

    const rowPayload: VariantInput[] = grid.map((valueIds) => ({
      valueIds,
      ...rowFor(valueIds),
    }));

    startTransition(async () => {
      const result = await saveVariants(productId, payload, rowPayload);

      if (!result.ok) {
        setError(result.error === "too-many" ? t.admin.variantTooMany : t.common.error);
        return;
      }

      setDone(true);
      router.refresh();
    });
  }

  return (
    <section className="card card-pad mt-4">
      <h2 className="text-sm font-bold text-ink-900">{t.admin.variantsTitle}</h2>
      <p className="mt-1 text-xs text-ink-500">{t.admin.variantsHint}</p>

      {/* ------------------------------ questions --------------------------- */}
      <div className="mt-4 flex flex-col gap-3">
        {options.map((option, index) => (
          <div key={option.id} className="card card-pad-tight">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-40 flex-1">
                <span className="field-label">{t.admin.variantOptionKa}</span>
                <input
                  value={option.nameKa}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, nameKa: event.target.value } : row,
                      ),
                    )
                  }
                  className="field h-9 w-full px-2.5 text-sm"
                />
              </label>

              <label className="min-w-40 flex-1">
                <span className="field-label">{t.admin.variantOptionEn}</span>
                <input
                  value={option.nameEn}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((row, i) =>
                        i === index ? { ...row, nameEn: event.target.value } : row,
                      ),
                    )
                  }
                  className="field h-9 w-full px-2.5 text-sm"
                />
              </label>

              <button
                type="button"
                onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                aria-label={t.admin.variantRemoveOption}
                className="btn btn-ghost h-9 w-9 rounded-control p-0 text-danger"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {option.values.map((value, position) => (
                <li key={value.id} className="flex flex-wrap items-center gap-2">
                  <input
                    value={value.valueKa}
                    placeholder={t.admin.variantValueKa}
                    aria-label={t.admin.variantValueKa}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                values: row.values.map((entry, j) =>
                                  j === position ? { ...entry, valueKa: event.target.value } : entry,
                                ),
                              }
                            : row,
                        ),
                      )
                    }
                    className="field h-8 min-w-32 flex-1 px-2 text-sm"
                  />
                  <input
                    value={value.valueEn}
                    placeholder={t.admin.variantValueEn}
                    aria-label={t.admin.variantValueEn}
                    onChange={(event) =>
                      setOptions((current) =>
                        current.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                values: row.values.map((entry, j) =>
                                  j === position ? { ...entry, valueEn: event.target.value } : entry,
                                ),
                              }
                            : row,
                        ),
                      )
                    }
                    className="field h-8 min-w-32 flex-1 px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setOptions((current) =>
                        current.map((row, i) =>
                          i === index
                            ? { ...row, values: row.values.filter((_, j) => j !== position) }
                            : row,
                        ),
                      )
                    }
                    aria-label={t.admin.variantRemoveValue}
                    className="btn btn-ghost h-8 w-8 rounded-control p-0 text-ink-400"
                  >
                    <CloseIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() =>
                setOptions((current) =>
                  current.map((row, i) =>
                    i === index
                      ? {
                          ...row,
                          values: [
                            ...row.values,
                            { id: tempId(), valueKa: "", valueEn: "", isNew: true },
                          ],
                        }
                      : row,
                  ),
                )
              }
              className="btn btn-outline btn-sm mt-2"
            >
              <PlusIcon size={14} />
              {t.admin.variantAddValue}
            </button>
          </div>
        ))}
      </div>

      {options.length === 0 && <p className="mt-3 text-sm text-ink-500">{t.admin.variantsNone}</p>}

      <button
        type="button"
        onClick={() =>
          setOptions((current) => [
            ...current,
            {
              id: tempId(),
              nameKa: "",
              nameEn: "",
              isNew: true,
              values: [{ id: tempId(), valueKa: "", valueEn: "", isNew: true }],
            },
          ])
        }
        className="btn btn-outline btn-sm mt-3"
      >
        <PlusIcon size={14} />
        {t.admin.variantAddOption}
      </button>

      {/* ---------------------------- combinations -------------------------- */}
      {grid.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-ink-900">{t.admin.variantGrid}</h3>

          <div className="card mt-2 overflow-x-auto">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>{t.admin.variantGrid}</th>
                  <th>{t.admin.variantSku}</th>
                  <th className="figures">{t.admin.variantPrice}</th>
                  <th className="figures">{t.admin.variantStock}</th>
                  <th>{t.admin.variantActive}</th>
                </tr>
              </thead>

              <tbody>
                {grid.map((valueIds) => {
                  const row = rowFor(valueIds);
                  const label = labelOf(valueIds);
                  return (
                    <tr key={keyOf(valueIds)}>
                      <td className="font-semibold text-ink-800">{label}</td>

                      <td>
                        <input
                          value={row.sku}
                          onChange={(event) => setRow(valueIds, { sku: event.target.value })}
                          aria-label={`${t.admin.variantSku} — ${label}`}
                          className="field h-8 w-28 px-2 font-mono text-xs"
                        />
                      </td>

                      <td className="figures">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={row.price}
                          placeholder={t.admin.variantPriceHint}
                          onChange={(event) => setRow(valueIds, { price: event.target.value })}
                          aria-label={`${t.admin.variantPrice} — ${label}`}
                          className="field h-8 w-24 px-2 text-right text-xs tabular-nums"
                        />
                      </td>

                      <td className="figures">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={row.stock}
                          onChange={(event) =>
                            setRow(valueIds, { stock: Number(event.target.value) })
                          }
                          aria-label={`${t.admin.variantStock} — ${label}`}
                          className="field h-8 w-20 px-2 text-right text-xs tabular-nums"
                        />
                      </td>

                      <td>
                        <label className="flex items-center">
                          <span className="sr-only">{`${t.admin.variantActive} — ${label}`}</span>
                          <input
                            type="checkbox"
                            checked={row.isActive}
                            onChange={(event) =>
                              setRow(valueIds, { isActive: event.target.checked })
                            }
                            className="h-4 w-4 accent-brand-600"
                          />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <ErrorNote className="mt-3" title={error} hint={t.common.errorHint} />}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={isPending} className="btn btn-primary btn-sm">
          {isPending && <SpinnerIcon size={14} />}
          {t.admin.variantSave}
        </button>

        {done && (
          <span role="status" className="text-sm font-semibold text-success">
            {t.admin.variantSaved}
          </span>
        )}
      </div>
    </section>
  );
}

/** A combination, as a key that does not care what order it was built in. */
function keyOf(valueIds: string[]): string {
  return [...valueIds].sort().join("|");
}
