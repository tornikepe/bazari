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
import { parsePhotos } from "../src/lib/product-photos";

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

/* Each builder takes what the page gave and asks that brand's own resizing
   endpoint for a twelve-hundred-pixel copy. Full-size originals are often
   past the two-megabyte ceiling — Margiela's are — and nothing on this site
   is drawn wider than that anyway. */
const A = (path: string) =>
  `https://assets.adidas.com/images/w_1200,f_auto,q_auto/${path}`;
const N = (path: string) =>
  `https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/${path}`;
const MM = (path: string) => {
  const [hash, file] = path.split("/");
  return `https://www.maisonmargiela.com/dw/image/v2/AAPK_PRD/on/demandware.static/-/Sites-margiela-master-catalog/default/${hash}/images/large/${file}.jpg?sw=1200&sfrm=jpg&q=80`;
};
const GG = (file: string) =>
  `https://static2.goldengoose.com/public/Style/ECOMM/${file}?im=Resize=(1200)`;

/**
 * SKU to every picture that brand serves on its own product page, in the
 * order the page shows them.
 *
 * Capped at eight because eight is what the gallery holds — `MAX_PHOTOS` in
 * `product-photos.ts`, which the upload control enforces too. A ninth would
 * be stored and never shown.
 */
const PHOTOS: Record<string, string[]> = {
  "ADI-IH8659": [
    "5643ea9848e94c1da869fd176bd19128_9366/Superstar_II_Shoes_White_IH8659_01_standard.jpg",
    "6a57f20797824055b52e39de67322cda_9366/Superstar_II_Shoes_White_IH8659_02_standard_hover.jpg",
    "c54e56d691cf4f3b982490a2ff603dc4_9366/Superstar_II_Shoes_White_IH8659_03_standard.jpg",
    "9817183346704f8f9c55b52dc9b71929_9366/Superstar_II_Shoes_White_IH8659_04_standard.jpg",
    "f0b5dc0841ae4b06b2b5675d2b7cc62b_9366/Superstar_II_Shoes_White_IH8659_05_standard.jpg",
    "262304d1c3b643b79d83b10f26f1eee5_9366/Superstar_II_Shoes_White_IH8659_06_standard.jpg",
    "1e9b8fd4a30849c68597f75f2e7cfd63_9366/Superstar_II_Shoes_White_IH8659_09_standard.jpg",
    "a0ff2ede6260451ca1250081c62183e4_9366/Superstar_II_Shoes_White_IH8659_HM51.jpg",
  ].map(A),
  "ADI-JI0079": [
    "1a6c516af64c4832829354533392a713_9366/Superstar_II_Shoes_Black_JI0079_01_standard.jpg",
    "7c1cfa6f04944bf18a2d1faee1e4762b_9366/Superstar_II_Shoes_Black_JI0079_02_standard_hover.jpg",
    "6992f476fc514050827ad286caee8fc8_9366/Superstar_II_Shoes_Black_JI0079_03_standard.jpg",
    "e696998c43e3451c96af7c2d700901f6_9366/Superstar_II_Shoes_Black_JI0079_04_standard.jpg",
    "964885d37aa1404997b32f08e68561d2_9366/Superstar_II_Shoes_Black_JI0079_05_standard.jpg",
    "5d89ee3779ec41e8b1fa8aad262bb7de_9366/Superstar_II_Shoes_Black_JI0079_06_standard.jpg",
    "285a6d307c404a48835e447a6daaa66c_9366/Superstar_II_Shoes_Black_JI0079_09_standard.jpg",
    "71dccd44264443bd82cc55c1acd3c2f8_9366/Superstar_II_Shoes_Black_JI0079_41_detail.jpg",
  ].map(A),
  "ADI-KK4722": [
    "e59bfad97b864732b78b39d4f8a327b5_9366/SUPERSTAR_II_shoes_Black_KK4722_01_00_standard.jpg",
    "28565c798cb847d186627c6f73738ae1_9366/SUPERSTAR_II_shoes_Black_KK4722_02_standard.jpg",
    "54a05d41cb8c4a019e3c1a1d1f7f55c1_9366/SUPERSTAR_II_shoes_Black_KK4722_03_standard.jpg",
    "1956b28e0da84b9689928b7de5b18523_9366/SUPERSTAR_II_shoes_Black_KK4722_04_standard.jpg",
    "e88d990c331349e38fb5805277fcc47b_9366/SUPERSTAR_II_shoes_Black_KK4722_05_standard.jpg",
    "2c2cb6add4514987821ed02329ab1231_9366/SUPERSTAR_II_shoes_Black_KK4722_06_standard.jpg",
    "a658f0a503fa4447a433da7e74733a58_9366/SUPERSTAR_II_shoes_Black_KK4722_09_standard.jpg",
    "457a3a9203fa49e488ef072418adbca7_9366/SUPERSTAR_II_shoes_Black_KK4722_41_detail.jpg",
  ].map(A),
  "ADI-M20324": [
    "69721f2e7c934d909168a80e00818569_9366/Stan_Smith_Shoes_White_M20324_01_standard.jpg",
    "7bc16c0933f849a1bbeba3470047af60_9366/Stan_Smith_Shoes_White_M20324_02_standard_hover.jpg",
    "8279e1e982284860b38da3470047ab6d_9366/Stan_Smith_Shoes_White_M20324_03_standard.jpg",
    "eb638fce8b4f4678b40aa80e00818f3a_9366/Stan_Smith_Shoes_White_M20324_04_standard.jpg",
    "8ce27a7891ad4a44b9f2a80e00819188_9366/Stan_Smith_Shoes_White_M20324_05_standard.jpg",
    "578fc42585f84690a0f0a80e008188cf_9366/Stan_Smith_Shoes_White_M20324_06_standard.jpg",
    "86ed42c633404d5fb377a6a500989c17_9366/Stan_Smith_Shoes_White_M20324_09_standard.jpg",
    "f7f13f58f83e46698f15aacb01622c54_9366/Stan_Smith_Shoes_White_M20324_HM51.jpg",
  ].map(A),
  "ADI-M20325": [
    "4edaa6d5b65a40d19f20a7fa00ea641f_9366/Stan_Smith_Shoes_White_M20325_01_standard.jpg",
    "032883d31557442c8275a347004753a4_9366/Stan_Smith_Shoes_White_M20325_02_standard_hover.jpg",
    "d4dff87f03d84a4c92dca34700474f79_9366/Stan_Smith_Shoes_White_M20325_03_standard.jpg",
    "9484876cdcb94b17a496a7fa00ea6ee9_9366/Stan_Smith_Shoes_White_M20325_06_standard.jpg",
    "bc1598164e0743d39b41aa9b010d771b_9366/Stan_Smith_Shoes_White_M20325_07_standard.jpg",
    "bdccdf07da8044e7a3aea6a5011cd730_9366/Stan_Smith_Shoes_White_M20325_09_standard.jpg",
    "df7de38cc7f842778ce5a34700475fed_9366/Stan_Smith_Shoes_White_M20325_41_detail.jpg",
    "e4952c3d2f434e61a5a5abb100ad8de9_9366/Stan_Smith_Shoes_White_M20325_HM51.jpg",
  ].map(A),
  "ADI-M20327": [
    "db6794325813405b9743a8903ea54c69_9366/Stan_Smith_Shoes_Black_M20327_01_standard.jpg",
    "2818ee3fe37a421c984e8104e22674dc_9366/Stan_Smith_Shoes_Black_M20327_02_standard_hover.jpg",
    "5a645ffb179c4de299b616fcbb118ccd_9366/Stan_Smith_Shoes_Black_M20327_03_standard.jpg",
    "7faa9c361e454697b23717a2bbcb6c85_9366/Stan_Smith_Shoes_Black_M20327_04_standard.jpg",
    "dedd9bebedf44dad9becaa0f27f6c03f_9366/Stan_Smith_Shoes_Black_M20327_05_standard.jpg",
    "ec434764cb714073a65d9429ad35aad7_9366/Stan_Smith_Shoes_Black_M20327_06_standard.jpg",
    "7b7c26331f324c0a9798408e20a3c7ab_9366/Stan_Smith_Shoes_Black_M20327_09_standard.jpg",
    "2a25bc1ae1184c908735dee0cc87eeae_9366/Stan_Smith_Shoes_Black_M20327_41_detail.jpg",
  ].map(A),
  "ADI-S75104": [
    "deecebcc265c43c6b092a7fa00fed2d0_9366/Stan_Smith_Shoes_White_S75104_01_standard.jpg",
    "74b3737efccd4b8389b9a55d013fae5d_9366/Stan_Smith_Shoes_White_S75104_02_standard_hover.jpg",
    "6e4d87b959024a379e62a55d013fa7f2_9366/Stan_Smith_Shoes_White_S75104_03_standard.jpg",
    "a76cd16a08c4463e98ffa7fa00fef60f_9366/Stan_Smith_Shoes_White_S75104_04_standard.jpg",
    "5cee79251d5a41be9490a7fa00feffd2_9366/Stan_Smith_Shoes_White_S75104_05_standard.jpg",
    "790cea5375e7485a877aa7fa00fedbdc_9366/Stan_Smith_Shoes_White_S75104_06_standard.jpg",
    "6edfd424d3f945c0ab16a6a5011e7850_9366/Stan_Smith_Shoes_White_S75104_09_standard.jpg",
    "81068a7f9f304192a52ba55d013fbf36_9366/Stan_Smith_Shoes_White_S75104_41_detail.jpg",
  ].map(A),
  "ADI-B75806": [
    "3bbecbdf584e40398446a8bf0117cf62_9366/Samba_OG_Shoes_White_B75806_01_00_standard.jpg",
    "ec595635a2994adea094a8bf0117ef1a_9366/Samba_OG_Shoes_White_B75806_02_standard_hover.jpg",
    "97cd0902ae2e402b895aa8bf0117f98f_9366/Samba_OG_Shoes_White_B75806_03_standard.jpg",
    "b067d21288bc43ec8298a8bf01180400_9366/Samba_OG_Shoes_White_B75806_04_standard.jpg",
    "3a8d5f9cb7444bd195f1a8bf01180e68_9366/Samba_OG_Shoes_White_B75806_05_standard.jpg",
    "07567ea7d2bb425b8651a8bf0117e4f1_9366/Samba_OG_Shoes_White_B75806_06_standard.jpg",
    "f9ce5733049f4ca8a93aa8bf011858bd_9366/Samba_OG_Shoes_White_B75806_09_standard.jpg",
    "1d9a02f0be704fafbe3d6b8158afb9f6_9366/Samba_OG_Shoes_White_B75806_HM52.jpg",
  ].map(A),
  "ADI-B75807": [
    "4c70105150234ac4b948a8bf01187e0c_9366/Samba_OG_Shoes_Black_B75807_01_standard.jpg",
    "309a0c8f53dd45d3a3bea8bf0118aa6b_9366/Samba_OG_Shoes_Black_B75807_02_standard_hover.jpg",
    "a3ffa88f92a74c6d9979a8bf0118b9d0_9366/Samba_OG_Shoes_Black_B75807_03_standard.jpg",
    "a766df52607e42858ddba8bf0118c6cb_9366/Samba_OG_Shoes_Black_B75807_04_standard.jpg",
    "ce28dd2ab7684e8bb00ba8bf0118d2cf_9366/Samba_OG_Shoes_Black_B75807_05_standard.jpg",
    "afa5435f1b5241eaba01a8bf01189c56_9366/Samba_OG_Shoes_Black_B75807_06_standard.jpg",
    "d0561b42bd25442e9144a8bf0119046b_9366/Samba_OG_Shoes_Black_B75807_09_standard.jpg",
    "99f7a73049474248a9c2a8bf0118ddab_9366/Samba_OG_Shoes_Black_B75807_41_detail.jpg",
  ].map(A),

  "NIK-CW2288-111": [
    "e6da41fa-1be4-4ce5-b89c-22be4f1f02d4/AIR+FORCE+1+%2707.png",
    "d0ad440c-2d9b-4a58-93a4-9e2ea050fea3/AIR+FORCE+1+%2707.png",
    "d62499db-6a46-43a7-8135-cefaa88124ed/AIR+FORCE+1+%2707.png",
    "6036bbbb-1cf1-410c-9546-8fb737c95797/AIR+FORCE+1+%2707.png",
    "ea33db62-7df9-480a-b5f7-3634525852eb/AIR+FORCE+1+%2707.png",
    "4e7ab05b-409d-4871-9806-0ce1726d3365/AIR+FORCE+1+%2707.png",
    "b4fff5a0-0204-4437-9181-c56817812daa/AIR+FORCE+1+%2707.png",
    "aa33f175-561c-4635-bea2-b516b18a70b8/AIR+FORCE+1+%2707.png",
  ].map(N),
  "NIK-CW2288-001": [
    "5daa00d9-afae-4125-a95c-fc71923b81c3/AIR+FORCE+1+%2707.png",
    "68cb650b-834c-4a7f-9bc6-f5d152a2a09c/AIR+FORCE+1+%2707.png",
    "60595005-c0b8-4cca-b70b-2204b2ef7817/AIR+FORCE+1+%2707.png",
    "823a35ac-268c-4afe-8a5c-c5094b4e1269/AIR+FORCE+1+%2707.png",
    "49276f7d-ad6c-49cd-9f69-2318afbd6857/AIR+FORCE+1+%2707.png",
    "b93fd2c1-b635-4bb9-a9a1-da33ae7e3efb/AIR+FORCE+1+%2707.png",
    "489c7ab1-0ee9-457d-98ff-c4115686ccaa/AIR+FORCE+1+%2707.png",
    "6dd19015-1d31-4126-bbd6-c25a9c996064/AIR+FORCE+1+%2707.png",
  ].map(N),
  "NIK-AV3595-002": [
    "xa3j5pmlqu9lz6y1xbsb/NIKE+SHOX+TL.png",
    "v4ioal0j6m0fcbflllhf/NIKE+SHOX+TL.png",
    "tjsuaod3rzzqtwqmwdj3/NIKE+SHOX+TL.png",
    "qusjntkofihorxn1zqjl/NIKE+SHOX+TL.png",
    "tyqre4rnewjtsim4vghu/NIKE+SHOX+TL.png",
    "jay3uesvvqtslhtnllcl/NIKE+SHOX+TL.png",
    "lpean26yehxni4alzybd/NIKE+SHOX+TL.png",
    "ffrhpr7arcm6nz4efeo1/NIKE+SHOX+TL.png",
  ].map(N),
  "NIK-IQ2311-001": [
    "a41237a9-559e-4623-927c-a37d61306705/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "303f19fd-2f73-49e9-bd67-8c727a1be80c/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "5a6540e0-a461-441e-9050-28a372060411/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "73aaed72-2b12-42d6-9694-9b39ac0e9730/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "3f223367-e17a-41ce-826a-575d1c95b126/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "8aceb9e1-6cc3-4e14-85ca-15006646ee37/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "fc78f3ca-9d8b-43de-ae13-cf0a674f2d8d/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
    "87100672-58af-4eb0-b916-5dc290a38a94/AIR+MAX+90+GS+SE+CARBON+%28GS%29.png",
  ].map(N),

  "MM-S57WS0236-T7167": [
    "dw0a85a5c3/S57WS0236_P1895_T7167_F",
    "dw0f95ffd9/S57WS0236_P1895_T7167_E",
    "dwabbc8059/S57WS0236_P1895_T7167_R",
    "dw8b527474/S57WS0236_P1895_T7167_D",
    "dw0370652d/S57WS0236_P1895_T7167_A",
    "dwf55bba44/S57WS0236_P1895_T7167_Q",
    "dwa0fd630e/S57WS0236_P1895_T7167_T",
    "dwdf059d4d/S57WS0236_P1895_T7167_L",
  ].map(MM),
  "MM-S57WS0236-T5081": [
    "dw900d7274/S57WS0236_P1895_T5081_F",
    "dwb287d9b4/S57WS0236_P1895_T5081_E",
    "dwa8602c76/S57WS0236_P1895_T5081_R",
    "dwda3a9dbb/S57WS0236_P1895_T5081_D",
    "dwa78d8c26/S57WS0236_P1895_T5081_A",
    "dw455cf2f8/S57WS0236_P1895_T5081_S",
    "dwc1a03319/S57WS0236_P1895_T5081_T",
    "dw115b385b/S57WS0236_P1895_T5081_L",
  ].map(MM),
  "MM-S57WS0236-T6065": [
    "dw76854758/S57WS0236_P1895_T6065_F",
    "dwec69d4b1/S57WS0236_P1895_T6065_E",
    "dw65653e1c/S57WS0236_P1895_T6065_R",
    "dw06a03b28/S57WS0236_P1895_T6065_D",
    "dw474b530f/S57WS0236_P1895_T6065_A",
    "dw8b52d561/S57WS0236_P1895_T6065_S",
    "dw740f8b2e/S57WS0236_P1895_T6065_T",
    "dw5937cd7b/S57WS0236_P1895_T6065_L",
  ].map(MM),
  "MM-S57WS0236-H6851": [
    "dw33133f30/S57WS0236_P1895_H6851_F",
    "dw59e473ba/S57WS0236_P1895_H6851_R",
    "dw54f19a34/S57WS0236_P1895_H6851_D",
    "dw27f69916/S57WS0236_P1895_H6851_A",
    "dw8b6ba779/S57WS0236_P1895_H6851_Q",
    "dw62541acb/S57WS0236_P1895_H6851_T",
    "dwe0453270/S57WS0236_P1895_H6851_L",
    "dwbe0ec1ac/S57WS0236_P1895_H6851_H",
  ].map(MM),

  "GG-GMF00117-51113": [
    "GMF00117.F008930-51113.jpg",
    "GMF00117.F008930-51113-2.jpg",
    "GMF00117.F008930-51113-4.jpg",
    "GMF00117.F008930-51113-5.jpg",
    "GMF00117.F008930-51113-6.jpg",
  ].map(GG),
  "GG-GWF00101-90100": [
    "GWF00101.F003463-90100.jpg",
    "GWF00101.F003463-90100-2.jpg",
    "GWF00101.F003463-90100-4.jpg",
    "GWF00101.F003463-90100-5.jpg",
    "GWF00101.F003463-90100-6.jpg",
  ].map(GG),
  "GG-GWF00102-10273": [
    "GWF00102.F004712-10273.jpg",
    "GWF00102.F004712-10273-2.jpg",
    "GWF00102.F004712-10273-4.jpg",
    "GWF00102.F004712-10273-5.jpg",
    "GWF00102.F004712-10273-6.jpg",
  ].map(GG),
  "GG-GWF00102-10220": [
    "GWF00102.F000318-10220.jpg",
    "GWF00102.F000318-10220-2.jpg",
    "GWF00102.F000318-10220-3.jpg",
    "GWF00102.F000318-10220-4.jpg",
    "GWF00102.F000318-10220-5.jpg",
    "GWF00102.F000318-10220-6.jpg",
  ].map(GG),
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
  let droppedCount = 0;

  for (const [sku, urls] of Object.entries(PHOTOS)) {
    const product = await prisma.product.findUnique({
      where: { sku },
      select: { id: true, nameEn: true, price: true, image: true, photos: true },
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

    /* Whatever this product is carrying now, so the rows can be dropped once
       the replacements are safely in. Read before the new ones are written,
       or the new ones would be in the list too. */
    const previous = parsePhotos(product.photos)
      .map((photo) => photo.url)
      .concat(product.image)
      .flatMap((url) => {
        const id = /^\/api\/images\/([^/?#]+)$/.exec(url)?.[1];
        return id ? [id] : [];
      });

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

    /* Only now, with the product pointing at the new pictures, are the old
       ones unreferenced and safe to remove. */
    if (previous.length > 0) {
      /* Except any a placed order snapshotted: an order line keeps the picture
         it was bought with, and deleting the row would leave a past order
         with a hole in it. */
      const spokenFor = new Set(
        (
          await prisma.orderItem.findMany({
            where: { image: { in: previous.map((id) => `/api/images/${id}`) } },
            select: { image: true },
          })
        ).map((line) => line.image.replace("/api/images/", "")),
      );
      const gone = await prisma.productImage.deleteMany({
        where: { id: { in: previous.filter((id) => !spokenFor.has(id)) } },
      });
      droppedCount += gone.count;
    }

    console.log(
      `  ${sku.padEnd(20)} ${stored.length} photo(s), ${filled.count} sizes × ${TEST_STOCK} — ${product.nameEn.slice(0, 40)}`,
    );
  }

  console.log(
    `\n${okCount} photograph(s) stored, ${failCount} refused, ${droppedCount} older one(s) dropped.`,
  );
  console.log("Stock and the Golden Goose prices are test values — replace them before opening.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
