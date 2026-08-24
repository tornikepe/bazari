"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";
import { generateSku } from "@/lib/sku";
import { combinations, totalStock, type Option } from "@/lib/variants";

/**
 * The shop stating what it sells in more than one form.
 *
 * One save for the whole thing — the questions, their answers, and the grid of
 * combinations underneath — because they are one thought. Adding "XL" and then
 * saving a variants table that does not have an XL row in it yet would be two
 * saves to express one change, and the state in between is a product that is
 * briefly missing a size.
 *
 * The combinations are generated rather than typed. Three sizes and two
 * colours is six rows, and nobody should have to enter six rows to say "six".
 * What a person *does* type is the stock, the price and the SKU on each — and
 * those survive an edit to the options, because rows are matched by the values
 * they are made of rather than by their position in a list.
 */

export type VariantResult =
  | { ok: true }
  | { ok: false; error: "unauthorized" | "invalid" | "too-many" | "sku-taken" | "failed" };

export type OptionInput = {
  id?: string;
  nameKa: string;
  nameEn: string;
  values: { id?: string; valueKa: string; valueEn: string }[];
};

export type VariantInput = {
  /** The value ids this row is made of — the only thing that identifies it. */
  valueIds: string[];
  sku: string;
  /** Lari as typed, or an empty string for "whatever the product costs". */
  price: string;
  stock: number;
  isActive: boolean;
};

/**
 * A ceiling on the grid.
 *
 * Combinations multiply, so three options with five answers each is 125 rows —
 * a table nobody can read and a page nobody can save. Sixty is more than a
 * small shop needs and far short of the number where this stops being a table
 * and starts being a spreadsheet.
 */
const MAX_VARIANTS = 60;
const MAX_OPTIONS = 3;
const MAX_VALUES = 20;

export async function saveVariants(
  productId: string,
  options: OptionInput[],
  variants: VariantInput[],
): Promise<VariantResult> {
  if (!(await getCurrentAdmin())) return { ok: false, error: "unauthorized" };

  if (!Array.isArray(options) || options.length > MAX_OPTIONS) return { ok: false, error: "invalid" };

  // Trimmed and emptied out before anything is counted: an option with no name
  // or no answers is a row somebody started and abandoned, not a question.
  const clean = options
    .map((option) => ({
      id: option.id,
      nameKa: String(option.nameKa ?? "").trim().slice(0, 60),
      nameEn: String(option.nameEn ?? "").trim().slice(0, 60),
      values: (option.values ?? [])
        .map((value) => ({
          id: value.id,
          valueKa: String(value.valueKa ?? "").trim().slice(0, 60),
          valueEn: String(value.valueEn ?? "").trim().slice(0, 60),
        }))
        .filter((value) => value.valueKa && value.valueEn)
        .slice(0, MAX_VALUES),
    }))
    .filter((option) => option.nameKa && option.nameEn && option.values.length > 0);

  const expected = clean.reduce((count, option) => count * option.values.length, 1);
  if (clean.length > 0 && expected > MAX_VARIANTS) return { ok: false, error: "too-many" };

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, category: { select: { slug: true } } },
  });
  if (!product) return { ok: false, error: "invalid" };

  try {
    await prisma.$transaction(async (tx) => {
      /* ---- the questions and their answers ---------------------------- */

      const existingOptions = await tx.productOption.findMany({
        where: { productId },
        select: { id: true, values: { select: { id: true } } },
      });

      /* The ids the browser sent, temporary ones included. A temporary id
         matches no row, so it neither keeps nor deletes anything — it is only
         here so the loop below can tell "this is the option I already had"
         from "this is one I have just been given". */
      const keptOptions = new Set(clean.map((option) => option.id).filter(Boolean) as string[]);
      await tx.productOption.deleteMany({
        where: { productId, id: { notIn: [...keptOptions] } },
      });

      /* Value ids as they end up in the database, per option, in the order the
         shop listed them. The generation below reads this and nothing else. */
      const shape: Option[] = [];

      /* What the browser called each value, mapped to what it is actually
         called now. A value typed in this session has no database id yet, so
         the rows underneath refer to it by a temporary one — and without this
         map, every freshly added size would look like a combination nobody had
         typed a stock figure for. */
      const realId = new Map<string, string>();

      for (const [index, option] of clean.entries()) {
        const known = existingOptions.find((row) => row.id === option.id);

        const saved = known
          ? await tx.productOption.update({
              where: { id: known.id },
              data: { nameKa: option.nameKa, nameEn: option.nameEn, sortOrder: index },
              select: { id: true },
            })
          : await tx.productOption.create({
              data: {
                productId,
                nameKa: option.nameKa,
                nameEn: option.nameEn,
                sortOrder: index,
              },
              select: { id: true },
            });

        const keptValues = new Set(option.values.map((value) => value.id).filter(Boolean) as string[]);
        await tx.productOptionValue.deleteMany({
          where: { optionId: saved.id, id: { notIn: [...keptValues] } },
        });

        const values: { id: string; label: string }[] = [];

        for (const [position, value] of option.values.entries()) {
          const isKnown = value.id && known?.values.some((row) => row.id === value.id);

          const row = isKnown
            ? await tx.productOptionValue.update({
                where: { id: value.id },
                data: { valueKa: value.valueKa, valueEn: value.valueEn, sortOrder: position },
                select: { id: true },
              })
            : await tx.productOptionValue.create({
                data: {
                  optionId: saved.id,
                  valueKa: value.valueKa,
                  valueEn: value.valueEn,
                  sortOrder: position,
                },
                select: { id: true },
              });

          if (value.id) realId.set(value.id, row.id);
          values.push({ id: row.id, label: value.valueEn });
        }

        shape.push({ id: saved.id, name: option.nameEn, values });
      }

      /* ---- the combinations ------------------------------------------- */

      const wanted = clean.length === 0 ? [] : combinations(shape);

      const existingVariants = await tx.productVariant.findMany({
        where: { productId },
        select: { id: true, sku: true, values: { select: { valueId: true } } },
      });

      /** A combination, as a key that does not care what order it was built in. */
      const keyOf = (valueIds: string[]) => [...valueIds].sort().join("|");

      const byKey = new Map(
        existingVariants.map((variant) => [keyOf(variant.values.map((v) => v.valueId)), variant]),
      );

      const typed = new Map(
        variants.map((row) => [keyOf(row.valueIds.map((id) => realId.get(id) ?? id)), row]),
      );
      const surviving: string[] = [];

      for (const [index, valueIds] of wanted.entries()) {
        const key = keyOf(valueIds);
        const known = byKey.get(key);
        const input = typed.get(key);

        const stock = Math.max(0, Math.floor(Number(input?.stock ?? 0)) || 0);
        const price =
          input && input.price.trim() !== "" && Number.isFinite(Number(input.price))
            ? Math.round(Number(input.price) * 100)
            : null;
        const isActive = input?.isActive ?? true;

        if (known) {
          await tx.productVariant.update({
            where: { id: known.id },
            data: { stock, price, isActive, sortOrder: index, sku: input?.sku.trim() || known.sku },
          });
          surviving.push(known.id);
          continue;
        }

        /* A new combination needs a code, and the shop is never asked to
           invent one — the same rule the product form follows. */
        const sku =
          input?.sku.trim() ||
          (await generateSku(product.category.slug, async (candidate) =>
            Boolean(
              await tx.productVariant.findUnique({ where: { sku: candidate }, select: { id: true } }),
            ),
          ));
        if (!sku) throw new Error("no free sku");

        const created = await tx.productVariant.create({
          data: {
            productId,
            sku,
            stock,
            price,
            isActive,
            sortOrder: index,
            values: { create: valueIds.map((valueId) => ({ valueId })) },
          },
          select: { id: true },
        });
        surviving.push(created.id);
      }

      // Combinations that no longer exist go, and the cascade takes their
      // value links with them. An order that bought one keeps its own copy of
      // the label, which is why that column exists.
      await tx.productVariant.deleteMany({
        where: { productId, id: { notIn: surviving } },
      });

      /* ---- and the product's own figure -------------------------------- */

      if (wanted.length > 0) {
        const rows = await tx.productVariant.findMany({
          where: { productId },
          select: { stock: true, isActive: true, id: true, sku: true, price: true },
        });

        /* The sum, kept on the product because every catalogue query reads one
           `stock` column and joining a sum into a list of twelve cards to draw
           one badge is a page of work for a number that changes rarely. */
        await tx.product.update({
          where: { id: productId },
          data: {
            stock: totalStock(
              rows.map((row) => ({
                id: row.id,
                sku: row.sku,
                price: row.price,
                stock: row.stock,
                isActive: row.isActive,
                valueIds: [],
              })),
            ),
          },
        });
      }
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === "P2002") return { ok: false, error: "sku-taken" };
    }
    console.error("saveVariants failed", error);
    return { ok: false, error: "failed" };
  }

  revalidatePath("/catalog");
  revalidatePath(`/dashboard/products/${productId}`);
  return { ok: true };
}
