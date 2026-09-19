/**
 * Loads a catalogue from a manifest: one category, its products, their
 * photos from disk, and a size (or any) option with a variant per value.
 *
 * Written for the first real stock — thirty pairs of shoes with their
 * pictures and specifications — but nothing in it knows about shoes. The
 * manifest is plain JSON, so the next batch can come from a spreadsheet or
 * a supplier feed without touching this file:
 *
 *   {
 *     "category": { "slug": "shoes", "nameKa": "ფეხსაცმელი", "nameEn": "Footwear", "icon": "👟", "sortOrder": 0 },
 *     "products": [{
 *       "slug": "puma-club-ii-era", "nameKa": "…", "nameEn": "…", "brand": "Puma",
 *       "sku": "39744702",                    // optional; generated when absent
 *       "descriptionKa": "…", "descriptionEn": "…",
 *       "price": 159, "oldPrice": 229,        // lari; the row holds tetri
 *       "costPrice": 95,                      // lari, optional — 60% of the price when absent
 *       "shippingDays": 3, "isFeatured": false,
 *       "specs": [{ "labelKa": "…", "labelEn": "…", "valueKa": "…", "valueEn": "…" }],
 *       "photos": ["img/01-1.webp", "…"],   // paths relative to the manifest; first is the cover
 *       "option": { "nameKa": "ზომა", "nameEn": "Size", "values": [{ "value": "42", "stock": 4 }] }
 *     }]
 *   }
 *
 * Photos are read from disk, checked the way an upload is checked (by
 * their bytes, not their extension), and stored as `ProductImage` rows —
 * the same rows the dashboard's upload makes, served from `/api/images`.
 * A product that already exists (by slug) is updated and its variants
 * rebuilt; its old photo rows are left for `forgetUnusedImages` to reap.
 *
 *   npx tsx scripts/import-products.ts path/to/manifest.json
 *
 * Against the database in `DATABASE_URL`, so for production take a backup
 * first (`npm run db:backup`).
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { checkUpload } from "../src/lib/image-upload";
import { generateSku } from "../src/lib/sku";

type Spec = { labelKa: string; labelEn: string; valueKa: string; valueEn: string };
type ManifestProduct = {
  slug: string;
  nameKa: string;
  nameEn: string;
  brand?: string;
  sku?: string;
  descriptionKa?: string;
  descriptionEn?: string;
  price: number;
  oldPrice?: number | null;
  costPrice?: number;
  shippingDays?: number;
  isFeatured?: boolean;
  specs?: Spec[];
  photos?: string[];
  option?: { nameKa: string; nameEn: string; values: { value: string; stock: number }[] };
};
type Manifest = {
  category: { slug: string; nameKa: string; nameEn: string; icon?: string; sortOrder?: number };
  products: ManifestProduct[];
};

const tetri = (lari: number) => Math.round(lari * 100);

async function storePhoto(file: string): Promise<string> {
  const bytes = new Uint8Array(fs.readFileSync(file));
  const checked = checkUpload(bytes);
  if (!checked.ok) throw new Error(`${file}: ${checked.reason}`);
  const row = await prisma.productImage.create({
    data: {
      data: Buffer.from(bytes),
      contentType: checked.type,
      filename: path.basename(file).slice(0, 120),
      bytes: bytes.byteLength,
    },
    select: { id: true },
  });
  return `/api/images/${row.id}`;
}

async function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) {
    console.error("usage: tsx scripts/import-products.ts <manifest.json>");
    process.exit(1);
  }
  const root = path.dirname(path.resolve(manifestPath));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;

  const category = await prisma.category.upsert({
    where: { slug: manifest.category.slug },
    update: {
      nameKa: manifest.category.nameKa,
      nameEn: manifest.category.nameEn,
      icon: manifest.category.icon ?? "📦",
      sortOrder: manifest.category.sortOrder ?? 0,
    },
    create: {
      slug: manifest.category.slug,
      nameKa: manifest.category.nameKa,
      nameEn: manifest.category.nameEn,
      icon: manifest.category.icon ?? "📦",
      sortOrder: manifest.category.sortOrder ?? 0,
    },
  });
  console.log(`→ category ${category.slug} (${category.nameKa})`);

  for (const item of manifest.products) {
    const photos: { url: string; altKa: string; altEn: string }[] = [];
    for (const file of item.photos ?? []) {
      const url = await storePhoto(path.resolve(root, file));
      photos.push({ url, altKa: item.nameKa, altEn: item.nameEn });
    }

    const existing = await prisma.product.findUnique({ where: { slug: item.slug }, select: { id: true, sku: true } });
    const sku =
      existing?.sku ??
      item.sku ??
      (await generateSku(category.slug, async (candidate) =>
        Boolean(await prisma.product.findUnique({ where: { sku: candidate }, select: { id: true } })),
      ));
    if (!sku) throw new Error(`${item.slug}: could not find a free SKU`);

    const values = item.option?.values ?? [];
    const stock = values.length ? values.reduce((sum, v) => sum + v.stock, 0) : 0;
    const price = tetri(item.price);
    const data = {
      nameKa: item.nameKa,
      nameEn: item.nameEn,
      brand: item.brand ?? "",
      descriptionKa: item.descriptionKa ?? "",
      descriptionEn: item.descriptionEn ?? "",
      price,
      oldPrice: item.oldPrice != null ? tetri(item.oldPrice) : null,
      costPrice: item.costPrice != null ? tetri(item.costPrice) : Math.round(price * 0.6),
      stock,
      lowStockAt: 5,
      image: photos[0]?.url ?? "/products/placeholder.svg",
      photos,
      specs: item.specs ?? [],
      shippingDays: item.shippingDays ?? 14,
      isFeatured: item.isFeatured ?? false,
      isActive: true,
      categoryId: category.id,
    };

    const product = existing
      ? await prisma.product.update({ where: { id: existing.id }, data })
      : await prisma.product.create({ data: { ...data, slug: item.slug, sku } });

    // Variants are rebuilt from the manifest: the option, its values, and
    // one variant per value carrying that value's stock.
    await prisma.productOption.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    if (item.option && values.length) {
      const option = await prisma.productOption.create({
        data: { productId: product.id, nameKa: item.option.nameKa, nameEn: item.option.nameEn, sortOrder: 0 },
      });
      for (const [index, value] of values.entries()) {
        const optionValue = await prisma.productOptionValue.create({
          data: { optionId: option.id, valueKa: value.value, valueEn: value.value, sortOrder: index },
        });
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: `${sku}-${value.value.replace(/[^A-Za-z0-9]+/g, "")}`,
            stock: value.stock,
            sortOrder: index,
            values: { create: { valueId: optionValue.id } },
          },
        });
      }
    }

    // The ledger opens with what came in, so the product page's history
    // starts at the delivery rather than at nothing.
    if (!existing && stock > 0) {
      await prisma.stockMovement.create({
        data: { productId: product.id, delta: stock, reason: "restock", balance: stock, note: "საწყისი მარაგი" },
      });
    }

    console.log(
      `  ${existing ? "updated" : "added"} ${item.nameKa} — ${item.price} ₾, ${photos.length} photos, ${values.length} sizes, stock ${stock}`,
    );
  }
  console.log(`${manifest.products.length} products done.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
