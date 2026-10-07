/**
 * Puts photographs on the twenty-one sneakers, and makes them testable.
 *
 * The addresses below are the ones each brand serves on its own product page
 * — the pages the shop chose these from. They are downloaded once through
 * `fetchImage`, which is the same guarded path the product editor uses when
 * somebody pastes a link: https only, the resolved address checked against
 * the private ranges, at most three redirects, a size ceiling, and the bytes
 * sniffed for what they actually are rather than trusted for what the server
 * called them. What lands in the database is the shop's own copy, served
 * from `/api/images`.
 *
 * **These are the brands' photographs**, and that was said plainly before
 * this was written: they belong to adidas, Nike, Maison Margiela and Golden
 * Goose, and whether this shop may publish them is the shop's own question
 * to answer with those brands. They are here because the shop asked for
 * them, to test a catalogue with real pictures in it rather than
 * twenty-one grey placeholders.
 *
 * It also sets a test stock and switches the products on, because a shop
 * with nothing in stock cannot be ordered from and therefore cannot be
 * tested. Every number it writes — the stock, and the price for the four
 * Golden Goose, which publish none — is a stand-in to be replaced before the
 * shop opens.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withVerifiedTls } from "../src/lib/db-url";
import { fetchImage } from "../src/lib/fetch-image";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: withVerifiedTls(connectionString) }),
});

/** How many of each size to pretend to have, so the shop can be ordered from. */
const TEST_STOCK = 5;

const A = (hash: string, file: string) =>
  `https://assets.adidas.com/images/w_1200,f_auto,q_auto/${hash}/${file}`;
const N = (path: string) =>
  `https://static.nike.com/a/images/t_default/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/${path}`;
const MM = (hash: string, file: string) =>
  `https://www.maisonmargiela.com/on/demandware.static/-/Sites-margiela-master-catalog/default/${hash}/images/large/${file}`;
const GG = (file: string) =>
  `https://static2.goldengoose.com/public/Style/ECOMM/${file}?im=Resize=(1200)`;

/** SKU to the pictures that brand serves for it, best first. */
const PHOTOS: Record<string, string[]> = {
  "ADI-IH8659": [
    A("5643ea9848e94c1da869fd176bd19128_9366", "Superstar_II_Shoes_White_IH8659_01_standard.jpg"),
    A("6a57f20797824055b52e39de67322cda_9366", "Superstar_II_Shoes_White_IH8659_02_standard_hover.jpg"),
    A("c54e56d691cf4f3b982490a2ff603dc4_9366", "Superstar_II_Shoes_White_IH8659_03_standard.jpg"),
  ],
  "ADI-JI0079": [
    A("1a6c516af64c4832829354533392a713_9366", "Superstar_II_Shoes_Black_JI0079_01_standard.jpg"),
    A("7c1cfa6f04944bf18a2d1faee1e4762b_9366", "Superstar_II_Shoes_Black_JI0079_02_standard_hover.jpg"),
    A("6992f476fc514050827ad286caee8fc8_9366", "Superstar_II_Shoes_Black_JI0079_03_standard.jpg"),
  ],
  "ADI-KK4722": [
    A("e59bfad97b864732b78b39d4f8a327b5_9366", "SUPERSTAR_II_shoes_Black_KK4722_01_00_standard.jpg"),
    A("28565c798cb847d186627c6f73738ae1_9366", "SUPERSTAR_II_shoes_Black_KK4722_02_standard.jpg"),
    A("54a05d41cb8c4a019e3c1a1d1f7f55c1_9366", "SUPERSTAR_II_shoes_Black_KK4722_03_standard.jpg"),
  ],
  "ADI-M20324": [
    A("69721f2e7c934d909168a80e00818569_9366", "Stan_Smith_Shoes_White_M20324_01_standard.jpg"),
    A("7bc16c0933f849a1bbeba3470047af60_9366", "Stan_Smith_Shoes_White_M20324_02_standard_hover.jpg"),
    A("8279e1e982284860b38da3470047ab6d_9366", "Stan_Smith_Shoes_White_M20324_03_standard.jpg"),
  ],
  "ADI-M20325": [
    A("4edaa6d5b65a40d19f20a7fa00ea641f_9366", "Stan_Smith_Shoes_White_M20325_01_standard.jpg"),
    A("032883d31557442c8275a347004753a4_9366", "Stan_Smith_Shoes_White_M20325_02_standard_hover.jpg"),
  ],
  "ADI-M20327": [
    A("db6794325813405b9743a8903ea54c69_9366", "Stan_Smith_Shoes_Black_M20327_01_standard.jpg"),
    A("2818ee3fe37a421c984e8104e22674dc_9366", "Stan_Smith_Shoes_Black_M20327_02_standard_hover.jpg"),
  ],
  "ADI-S75104": [
    A("deecebcc265c43c6b092a7fa00fed2d0_9366", "Stan_Smith_Shoes_White_S75104_01_standard.jpg"),
    A("74b3737efccd4b8389b9a55d013fae5d_9366", "Stan_Smith_Shoes_White_S75104_02_standard_hover.jpg"),
  ],
  "ADI-B75806": [
    A("3bbecbdf584e40398446a8bf0117cf62_9366", "Samba_OG_Shoes_White_B75806_01_00_standard.jpg"),
    A("ec595635a2994adea094a8bf0117ef1a_9366", "Samba_OG_Shoes_White_B75806_02_standard_hover.jpg"),
  ],
  "ADI-B75807": [
    A("4c70105150234ac4b948a8bf01187e0c_9366", "Samba_OG_Shoes_Black_B75807_01_standard.jpg"),
    A("309a0c8f53dd45d3a3bea8bf0118aa6b_9366", "Samba_OG_Shoes_Black_B75807_02_standard_hover.jpg"),
  ],

  "NIK-CW2288-111": [N("b7d9211c-26e7-431a-ac24-b0540fb3c00f/AIR+FORCE+1+%2707.png")],
  "NIK-CW2288-001": [N("fc4622c4-2769-4665-aa6e-42c974a7705e/AIR+FORCE+1+%2707.png")],
  "NIK-AV3595-002": [N("tjkr8ecmktw7qooy9d0h/NIKE+SHOX+TL.png")],
  "NIK-IQ2311-001": [N("a7c05ec3-6a62-4ad5-90f7-ffa9f37c673f/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png")],

  /* This one's full-size JPEG is over the two-megabyte ceiling, so it is
     taken from the resizing endpoint the site itself uses. */
  "MM-S57WS0236-T7167": [
    "https://www.maisonmargiela.com/dw/image/v2/AAPK_PRD/on/demandware.static/-/Sites-margiela-master-catalog/default/dw0a85a5c3/images/large/S57WS0236_P1895_T7167_F.webp?sw=1200&sfrm=jpg&q=80",
  ],
  "MM-S57WS0236-T5081": [MM("dw900d7274", "S57WS0236_P1895_T5081_F.jpg")],
  "MM-S57WS0236-T6065": [MM("dw76854758", "S57WS0236_P1895_T6065_F.jpg")],
  "MM-S57WS0236-H6851": [MM("dw33133f30", "S57WS0236_P1895_H6851_F.jpg")],

  "GG-GMF00117-51113": [GG("GMF00117.F008930-51113.jpg"), GG("GMF00117.F008930-51113-2.jpg")],
  "GG-GWF00101-90100": [GG("GWF00101.F003463-90100.jpg"), GG("GWF00101.F003463-90100-2.jpg")],
  "GG-GWF00102-10273": [GG("GWF00102.F004712-10273.jpg"), GG("GWF00102.F004712-10273-2.jpg")],
  "GG-GWF00102-10220": [GG("GWF00102.F000318-10220.jpg"), GG("GWF00102.F000318-10220-2.jpg")],
};

/** Golden Goose publishes no price without a region, so these stand in. */
const TEST_PRICE: Record<string, number> = {
  "GG-GMF00117-51113": 1450_00,
  "GG-GWF00101-90100": 1500_00,
  "GG-GWF00102-10273": 1500_00,
  "GG-GWF00102-10220": 1500_00,
};

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This downloads each brand's photographs and switches the sneakers on.");
    console.error("Take a backup (npm run db:backup), then run it again with --yes.");
    process.exit(1);
  }

  let okCount = 0;
  let failCount = 0;

  for (const [sku, urls] of Object.entries(PHOTOS)) {
    const product = await prisma.product.findUnique({
      where: { sku },
      select: { id: true, nameEn: true, price: true, image: true },
    });
    if (!product) {
      console.log(`  ${sku.padEnd(20)} not in the catalogue — skipped`);
      continue;
    }

    /* Already has its own picture. Left alone unless asked, so a re-run to
       fix one product does not download the other twenty again and leave
       forty orphaned rows behind it. */
    if (product.image.startsWith("/api/images/") && !process.argv.includes("--force")) {
      console.log(`  ${sku.padEnd(20)} already has photographs — left alone`);
      continue;
    }

    const stored: { url: string; altKa: string; altEn: string }[] = [];
    for (const url of urls) {
      const got = await fetchImage(url);
      if (!got.ok) {
        console.log(`  ${sku.padEnd(20)} ${got.reason}: ${url.slice(0, 70)}`);
        failCount++;
        continue;
      }
      const row = await prisma.productImage.create({
        data: {
          data: Buffer.from(got.bytes),
          contentType: got.type,
          bytes: got.bytes.byteLength,
          filename: decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "").slice(0, 120),
        },
        select: { id: true },
      });
      stored.push({ url: `/api/images/${row.id}`, altKa: "", altEn: "" });
      okCount++;
    }

    if (stored.length === 0) continue;

    await prisma.product.update({
      where: { id: product.id },
      data: {
        image: stored[0]!.url,
        photos: stored,
        isActive: true,
        ...(TEST_PRICE[sku] ? { price: TEST_PRICE[sku] } : {}),
      },
    });

    // Stock per size, so a size can actually be put in a basket.
    const filled = await prisma.productVariant.updateMany({
      where: { productId: product.id },
      data: { stock: TEST_STOCK },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: filled.count * TEST_STOCK },
    });

    console.log(
      `  ${sku.padEnd(20)} ${stored.length} photo(s), ${filled.count} sizes × ${TEST_STOCK} — ${product.nameEn.slice(0, 40)}`,
    );
  }

  console.log(`\n${okCount} photograph(s) stored, ${failCount} refused.`);
  console.log("Stock and the Golden Goose prices are test values — replace them before opening.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
