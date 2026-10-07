/**
 * Replaces the shoe category with the twenty-one sneakers the shop decided
 * to carry.
 *
 * A one-off, kept in the repository because it is the record of what was put
 * in and how. Run once with `--yes`; running it again replaces the same
 * twenty-one rather than adding them twice, because every row is keyed on its
 * slug.
 *
 * **What this writes and what it does not.** The facts come from each brand's
 * own product page: the model, the colourway as the maker names it, the
 * article code, the materials, the list price. Facts are facts and a shop may
 * state them. The prose is written here rather than copied, because a
 * brand's marketing copy is the brand's to publish.
 *
 * It writes no photographs. A product photograph on adidas.com or
 * goldengoose.com belongs to adidas and to Golden Goose, and a shop that
 * reposts one is republishing somebody else's work. Those have to come from
 * the shop: its own pictures, or the brand's media kit if it is an
 * authorised retailer. Every row therefore lands on the placeholder.
 *
 * Everything lands **switched off**, with no stock, because two things in
 * each row are the shop's to decide and nobody else's: what it sells for and
 * how many it has. The price written here is the brand's own list price
 * converted at 2,7 ₾ to the dollar — a starting point to be replaced, not a
 * recommendation — and the cost price is left at zero, which is the one
 * figure only the shop knows.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { withVerifiedTls } from "../src/lib/db-url";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: withVerifiedTls(connectionString) }),
});

/** Lari to the dollar, for turning a list price into a starting point. */
const GEL = 2.7;
const lari = (usd: number) => Math.round((usd * GEL) / 5) * 5 * 100;

type Spec = { labelKa: string; labelEn: string; valueKa: string; valueEn: string };
type Sneaker = {
  slug: string;
  sku: string;
  brand: string;
  nameKa: string;
  nameEn: string;
  colourKa: string;
  colourEn: string;
  usd: number | null;
  descKa: string;
  descEn: string;
  specs: Spec[];
  sizes: string[];
};

/* The size runs, by how each maker cuts them. */
const ADIDAS = ["36", "36 2/3", "37 1/3", "38", "38 2/3", "39 1/3", "40", "40 2/3", "41 1/3", "42", "42 2/3", "43 1/3", "44", "44 2/3"];
const NIKE_MEN = ["40", "40.5", "41", "42", "42.5", "43", "44", "44.5", "45", "46"];
const NIKE_KIDS = ["35.5", "36", "36.5", "37.5", "38", "38.5", "39", "40"];
const EU_39_46 = ["39", "40", "41", "42", "43", "44", "45", "46"];
const GG_WOMEN = ["35", "36", "37", "38", "39", "40", "41"];
const GG_MEN = ["39", "40", "41", "42", "43", "44", "45"];

const spec = (ka: string, en: string, vKa: string, vEn: string): Spec => ({
  labelKa: ka, labelEn: en, valueKa: vKa, valueEn: vEn,
});
const leatherSpecs = (soleKa: string, soleEn: string): Spec[] => [
  spec("ტიპი", "Type", "კედი", "Trainers"),
  spec("ზედაპირი", "Upper", "ტყავი", "Leather"),
  spec("ძირი", "Outsole", soleKa, soleEn),
];

const SNEAKERS: Sneaker[] = [
  /* ---------------------------- adidas ---------------------------- */
  {
    slug: "adidas-superstar-ii-white", sku: "ADI-IH8659", brand: "adidas",
    nameKa: "adidas Superstar II", nameEn: "adidas Superstar II",
    colourKa: "თეთრი / შავი", colourEn: "Cloud White / Core Black",
    usd: 100,
    descKa: "Superstar-ის ნიჟარისებრი ცხვირი 1970-იანების კალათბურთის მოედნიდან მოდის და მას შემდეგ ქუჩის ჩაცმულობის ნაწილია. გლუვი ტყავის ზედაპირი, სამი ზოლი გვერდზე და რეზინის ძირი — ზუსტად ის, რაც უნდა იყოს.",
    descEn: "The Superstar's rubber shell toe came off a 1970s basketball court and never left the street. A smooth leather upper, the three stripes along the side and a rubber cupsole — exactly what it should be.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "თეთრი / შავი", "Cloud White / Core Black"), spec("არტიკული", "Article", "IH8659", "IH8659")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-superstar-ii-black", sku: "ADI-JI0079", brand: "adidas",
    nameKa: "adidas Superstar II", nameEn: "adidas Superstar II",
    colourKa: "შავი / თეთრი", colourEn: "Core Black / Cloud White",
    usd: 100,
    descKa: "იგივე Superstar, შავ ტყავში. თეთრი სამი ზოლი და ნიჟარისებრი ცხვირი კონტრასტში რჩება, ძირი კი რეზინისაა — ყოველდღიური წყვილი, რომელიც ჭუჭყს ნაკლებად ამჩნევს.",
    descEn: "The same Superstar in black leather. The white stripes and shell toe keep the contrast, the sole is rubber — an everyday pair that shows dirt less.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "შავი / თეთრი", "Core Black / Cloud White"), spec("არტიკული", "Article", "JI0079", "JI0079")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-superstar-ii-black-gold", sku: "ADI-KK4722", brand: "adidas",
    nameKa: "adidas Superstar II", nameEn: "adidas Superstar II",
    colourKa: "შავი / ოქროსფერი", colourEn: "Core Black / Gold Metallic",
    usd: 100,
    descKa: "Superstar II მთლიან შავ ტყავში, ოქროსფერი დეტალებით. უფრო მოკრძალებული და უფრო საღამოს ვარიანტი იმავე სილუეტისა.",
    descEn: "Superstar II in full black leather with gold detailing. A quieter, more evening-leaning take on the same silhouette.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "შავი / ოქროსფერი", "Core Black / Gold Metallic"), spec("არტიკული", "Article", "KK4722", "KK4722")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-stan-smith-green", sku: "ADI-M20324", brand: "adidas",
    nameKa: "adidas Stan Smith", nameEn: "adidas Stan Smith",
    colourKa: "თეთრი / მწვანე", colourEn: "Cloud White / Green",
    usd: 100,
    descKa: "1971 წლის ჩოგბურთის კედი, რომელიც ქუჩაში დარჩა. თეთრი ტყავი, მწვანე ქუსლი და პერფორირებული სამი ზოლი — უმარტივესი და სწორედ ამიტომ ყველაფერთან მისადაგებული.",
    descEn: "A 1971 tennis shoe that stayed on the street. White leather, a green heel tab and perforated three stripes — the plainest there is, and that is why it goes with everything.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "თეთრი / მწვანე", "Cloud White / Green"), spec("არტიკული", "Article", "M20324", "M20324")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-stan-smith-navy", sku: "ADI-M20325", brand: "adidas",
    nameKa: "adidas Stan Smith", nameEn: "adidas Stan Smith",
    colourKa: "თეთრი / მუქი ლურჯი", colourEn: "Core White / Dark Blue",
    usd: 100,
    descKa: "იგივე Stan Smith, მუქი ლურჯი ქუსლით მწვანის ნაცვლად. თეთრი ტყავი და პერფორირებული ზოლები უცვლელია.",
    descEn: "The same Stan Smith with a dark blue heel tab in place of the green. The white leather and perforated stripes are unchanged.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "თეთრი / მუქი ლურჯი", "Core White / Dark Blue"), spec("არტიკული", "Article", "M20325", "M20325")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-stan-smith-black", sku: "ADI-M20327", brand: "adidas",
    nameKa: "adidas Stan Smith", nameEn: "adidas Stan Smith",
    colourKa: "მთლიანად შავი", colourEn: "Core Black",
    usd: 100,
    descKa: "Stan Smith მთლიანად შავში — ტყავიც, ქუსლიც, ძირიც. იმავე სილუეტის ყველაზე მშვიდი ვერსია.",
    descEn: "Stan Smith in all black — the leather, the heel tab and the sole. The quietest version of the same silhouette.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "შავი", "Core Black"), spec("არტიკული", "Article", "M20327", "M20327")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-stan-smith-triple-white", sku: "ADI-S75104", brand: "adidas",
    nameKa: "adidas Stan Smith", nameEn: "adidas Stan Smith",
    colourKa: "მთლიანად თეთრი", colourEn: "Cloud White",
    usd: 100,
    descKa: "მთლიანად თეთრი Stan Smith, ფერადი ქუსლის გარეშე. ყველაზე სუფთა ვარიანტი — და ყველაზე მომთხოვნიც მოვლაში.",
    descEn: "Stan Smith in white throughout, with no coloured heel tab. The cleanest version — and the one that asks the most looking after.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ფერი", "Colour", "თეთრი", "Cloud White"), spec("არტიკული", "Article", "S75104", "S75104")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-samba-og-white", sku: "ADI-B75806", brand: "adidas",
    nameKa: "adidas Samba OG", nameEn: "adidas Samba OG",
    colourKa: "თეთრი / შავი / რეზინის ძირი", colourEn: "Cloud White / Core Black / Gum",
    usd: 100,
    descKa: "Samba საფეხბურთო დარბაზისთვის დაიბადა და ქუჩაში გადავიდა. დაბალი სილუეტი, რბილი ტყავი, ზამშის გადაფარებები ცხვირზე და რეზინის ძირი.",
    descEn: "The Samba was born for the indoor pitch and moved to the street. A low profile, soft leather, suede overlays at the toe and a gum sole.",
    specs: [...leatherSpecs("რეზინი (gum)", "Gum rubber"), spec("ფერი", "Colour", "თეთრი / შავი", "Cloud White / Core Black"), spec("არტიკული", "Article", "B75806", "B75806")],
    sizes: ADIDAS,
  },
  {
    slug: "adidas-samba-og-black", sku: "ADI-B75807", brand: "adidas",
    nameKa: "adidas Samba OG", nameEn: "adidas Samba OG",
    colourKa: "შავი / თეთრი / რეზინის ძირი", colourEn: "Core Black / Cloud White / Gum",
    usd: 100,
    descKa: "იგივე Samba შავ ტყავში, თეთრი ზოლებით და რეზინის ძირით.",
    descEn: "The same Samba in black leather, with white stripes and a gum sole.",
    specs: [...leatherSpecs("რეზინი (gum)", "Gum rubber"), spec("ფერი", "Colour", "შავი / თეთრი", "Core Black / Cloud White"), spec("არტიკული", "Article", "B75807", "B75807")],
    sizes: ADIDAS,
  },

  /* ----------------------------- Nike ----------------------------- */
  {
    slug: "nike-air-force-1-07-white", sku: "NIK-CW2288-111", brand: "Nike",
    nameKa: "Nike Air Force 1 '07", nameEn: "Nike Air Force 1 '07",
    colourKa: "მთლიანად თეთრი", colourEn: "White / White",
    usd: 115,
    descKa: "80-იანების კალათბურთის კედი, რომელიც არასოდეს გასულა მოდიდან. ტყავის ზედაპირი პერფორირებული ცხვირით, Nike Air ბალიშით და რეზინის ძირით.",
    descEn: "An '80s basketball shoe that never went out. A leather upper with a perforated toe box, Nike Air cushioning underfoot and a rubber outsole.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ამორტიზაცია", "Cushioning", "Nike Air", "Nike Air"), spec("არტიკული", "Article", "CW2288-111", "CW2288-111")],
    sizes: NIKE_MEN,
  },
  {
    slug: "nike-air-force-1-07-black", sku: "NIK-CW2288-001", brand: "Nike",
    nameKa: "Nike Air Force 1 '07", nameEn: "Nike Air Force 1 '07",
    colourKa: "მთლიანად შავი", colourEn: "Black / Black",
    usd: 115,
    descKa: "იგივე Air Force 1, მთლიანად შავ ტყავში. იგივე Nike Air ბალიში და რეზინის ძირი.",
    descEn: "The same Air Force 1 in black leather throughout. The same Nike Air cushioning and rubber outsole.",
    specs: [...leatherSpecs("რეზინი", "Rubber"), spec("ამორტიზაცია", "Cushioning", "Nike Air", "Nike Air"), spec("არტიკული", "Article", "CW2288-001", "CW2288-001")],
    sizes: NIKE_MEN,
  },
  {
    slug: "nike-shox-tl-black-orange", sku: "NIK-AV3595-002", brand: "Nike",
    nameKa: "Nike Shox TL", nameEn: "Nike Shox TL",
    colourKa: "შავი / ნარინჯისფერი", colourEn: "Black / Metallic Hematite / Max Orange",
    usd: 180,
    descKa: "2003 წლის Shox, სრული სიგრძის სვეტებით ქუსლიდან ცხვირამდე. მესერიანი ზედაპირი TPU კარკასში, TPU ფირფიტა ქუსლზე სტაბილურობისთვის.",
    descEn: "The 2003 Shox, with its columns running the full length of the sole. A breathable mesh upper inside a TPU cage, and a TPU heel plate for stability.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "მესერი და TPU", "Mesh and TPU"),
      spec("ამორტიზაცია", "Cushioning", "Nike Shox", "Nike Shox"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("არტიკული", "Article", "AV3595-002", "AV3595-002"),
    ],
    sizes: NIKE_MEN,
  },
  {
    slug: "nike-air-max-90-se-gs", sku: "NIK-IQ2311-001", brand: "Nike",
    nameKa: "Nike Air Max 90 SE (ბავშვის)", nameEn: "Nike Air Max 90 SE (Big Kids')",
    colourKa: "შავი / ვერცხლისფერი", colourEn: "Black / Metallic Silver / Iron Grey",
    usd: 120,
    descKa: "Air Max 90 მოზარდის ზომებში. ხილული Max Air ბალიში ქუსლში, ტყავისა და სინთეტიკის ზედაპირი და რეზინის ვაფლისებრი ძირი. შუქამრეკლი დეტალები.",
    descEn: "The Air Max 90 in big kids' sizes. A visible Max Air unit in the heel, a leather and synthetic upper and a rubber waffle outsole. Reflective detailing.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ტყავი და სინთეტიკა", "Leather and synthetic"),
      spec("ამორტიზაცია", "Cushioning", "Max Air", "Max Air"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("არტიკული", "Article", "IQ2311-001", "IQ2311-001"),
    ],
    sizes: NIKE_KIDS,
  },

  /* ------------------------ Maison Margiela ------------------------ */
  ...([
    ["military-green", "T7167", "სამხედრო მწვანე", "Military Green"],
    ["winetasting", "T5081", "ღვინისფერი", "Winetasting"],
    ["blue-night", "T6065", "ღამის ლურჯი", "Blue Night"],
    ["black", "H6851", "შავი", "Black"],
  ] as const).map(([key, code, ka, en]): Sneaker => ({
    slug: `maison-margiela-replica-${key}`,
    sku: `MM-S57WS0236-${code}`,
    brand: "Maison Margiela",
    nameKa: "Maison Margiela Replica",
    nameEn: "Maison Margiela Replica",
    colourKa: ka, colourEn: en,
    usd: 850,
    descKa: `70-იანების ავსტრიული სავარჯიშო ფეხსაცმლის მიხედვით აგებული სილუეტი. ხბოს ტყავი, ბამბის სარჩული, თაფლისფერი რეზინის ძირი და თეთრი ნაკერი ქუსლზე. 3 სმ ქუსლი. დამზადებულია იტალიაში. ფერი — ${ka}.`,
    descEn: `A silhouette built after Austrian sports shoes of the seventies. Calf leather, cotton lining, a honey-coloured rubber sole and white stitching at the back. A 3 cm heel. Made in Italy. Colour — ${en}.`,
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ხბოს ტყავი", "Calf leather"),
      spec("სარჩული", "Lining", "ბამბა", "Cotton"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("წარმოება", "Made in", "იტალია", "Italy"),
      spec("არტიკული", "Article", `S57WS0236P1895${code}`, `S57WS0236P1895${code}`),
    ],
    sizes: EU_39_46,
  })),

  /* -------------------------- Golden Goose ------------------------- */
  {
    slug: "golden-goose-ball-star-blue-suede", sku: "GG-GMF00117-51113", brand: "Golden Goose",
    nameKa: "Golden Goose Ball Star", nameEn: "Golden Goose Ball Star",
    colourKa: "მუქი ლურჯი ზამში / თეთრი ვარსკვლავი", colourEn: "Dark blue suede / white leather star",
    usd: null,
    descKa: "ამერიკული კოლეჯის კალათბურთის სტილზე აგებული სილუეტი, განზრახ გაცვეთილი დამუშავებით. მუქი ლურჯი ზამშის ზედაპირი, თეთრი ტყავის ვარსკვლავი გვერდზე. ხელით დამზადებული იტალიაში.",
    descEn: "A silhouette built on American college basketball, finished with a deliberate lived-in effect. A dark blue suede upper with a white leather star at the side. Handmade in Italy.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ზამში (ძროხის ტყავი)", "Cow suede"),
      spec("ძირი", "Outsole", "თერმოპლასტიკური პოლიურეთანი", "Thermoplastic polyurethane"),
      spec("წარმოება", "Made in", "იტალია, ხელით", "Italy, handmade"),
      spec("არტიკული", "Article", "GMF00117.F008930.51113", "GMF00117.F008930.51113"),
    ],
    sizes: GG_MEN,
  },
  {
    slug: "golden-goose-super-star-black-nappa", sku: "GG-GWF00101-90100", brand: "Golden Goose",
    nameKa: "Golden Goose Super-Star (ქალის)", nameEn: "Golden Goose Super-Star (Women's)",
    colourKa: "შავი ნაპა / შავი ბზინვარე ქუსლი", colourEn: "Black nappa / black glitter heel tab",
    usd: null,
    descKa: "შავი ნაპა ტყავის ზედაპირი, შავი ზამშის ვარსკვლავი და ბზინვარე ქუსლის ენა. ვინტაჟური დამუშავება, ხელით აწყობილი იტალიაში.",
    descEn: "A black nappa leather upper, a black suede star and a glitter heel tab. A vintage finish, assembled by hand in Italy.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ნაპა ტყავი", "Nappa leather"),
      spec("სარჩული", "Lining", "ტყავი და ბამბა", "Leather and cotton"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("წარმოება", "Made in", "იტალია, ხელით", "Italy, handmade"),
      spec("არტიკული", "Article", "GWF00101.F003463.90100", "GWF00101.F003463.90100"),
    ],
    sizes: GG_WOMEN,
  },
  {
    slug: "golden-goose-super-star-grey-star", sku: "GG-GWF00102-10273", brand: "Golden Goose",
    nameKa: "Golden Goose Super-Star (ქალის)", nameEn: "Golden Goose Super-Star (Women's)",
    colourKa: "თეთრი / ნაცრისფერი ვარსკვლავი", colourEn: "White / ice-grey star",
    usd: null,
    descKa: "თეთრი ტყავის ზედაპირი ნაცრისფერი ზამშის ვარსკვლავით, ვერცხლისფერი ბზინვარე ქუსლის ენით და კრემისფერი თასმებით. ხელით დამზადებული იტალიაში.",
    descEn: "A white leather upper with an ice-grey suede star, a silver glitter heel tab and cream laces. Handmade in Italy.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ძროხის ტყავი", "Cow leather"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("წარმოება", "Made in", "იტალია, ხელით", "Italy, handmade"),
      spec("არტიკული", "Article", "GWF00102.F004712.10273", "GWF00102.F004712.10273"),
    ],
    sizes: GG_WOMEN,
  },
  {
    slug: "golden-goose-super-star-stud-lettering", sku: "GG-GWF00102-10220", brand: "Golden Goose",
    nameKa: "Golden Goose Super-Star (ქალის)", nameEn: "Golden Goose Super-Star (Women's)",
    colourKa: "თეთრი / შავი ქუსლის ენა", colourEn: "White / black heel tab",
    usd: null,
    descKa: "თეთრი ტყავი, ზამშის ვარსკვლავი, შავი ტყავის ქუსლის ენა და ლითონის ქინძისთავებით ამოყვანილი წარწერა. ვინტაჟური დამუშავება, ხელით ნაკეთები ვენეციაში.",
    descEn: "White leather, a suede star, a black leather heel tab and lettering picked out in metal studs. A vintage finish, handmade in Venice.",
    specs: [
      spec("ტიპი", "Type", "კედი", "Trainers"),
      spec("ზედაპირი", "Upper", "ძროხის ტყავი", "Cow leather"),
      spec("სარჩული", "Lining", "ტყავი და ბამბა", "Leather and cotton"),
      spec("ძირი", "Outsole", "რეზინი", "Rubber"),
      spec("წარმოება", "Made in", "იტალია, ხელით", "Italy, handmade"),
      spec("არტიკული", "Article", "GWF00102.F000318.10220", "GWF00102.F000318.10220"),
    ],
    sizes: GG_WOMEN,
  },
];

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error("This deletes every product in the shoe category and writes 21 new ones.");
    console.error("Take a backup (npm run db:backup), then run it again with --yes.");
    process.exit(1);
  }

  /* Made if it is not there. A database restored from the seed alone has no
     shoe category, and a one-off import that falls over on a fresh machine
     is a one-off import nobody can re-run. */
  const category = await prisma.category.upsert({
    where: { slug: "shoes" },
    update: {},
    create: {
      slug: "shoes",
      nameKa: "ფეხსაცმელი",
      nameEn: "Shoes",
      icon: "\u{1F45F}",
      sortOrder: 10,
    },
    select: { id: true },
  });

  const gone = await prisma.product.deleteMany({ where: { categoryId: category.id } });
  console.log(`removed ${gone.count} product(s) from the shoe category`);

  for (const shoe of SNEAKERS) {
    const product = await prisma.product.create({
      data: {
        slug: shoe.slug,
        sku: shoe.sku,
        nameKa: `${shoe.nameKa} — ${shoe.colourKa}`,
        nameEn: `${shoe.nameEn} — ${shoe.colourEn}`,
        descriptionKa: shoe.descKa,
        descriptionEn: shoe.descEn,
        brand: shoe.brand,
        categoryId: category.id,
        price: shoe.usd === null ? 0 : lari(shoe.usd),
        costPrice: 0,
        stock: 0,
        lowStockAt: 2,
        shippingDays: 14,
        // Off until the shop has put its own price, its own stock and its own
        // photographs on it. See the note at the top of this file.
        isActive: false,
        isFeatured: false,
        specs: shoe.specs,
        image: "/products/placeholder.svg",
        photos: [],
      },
      select: { id: true },
    });

    const option = await prisma.productOption.create({
      data: { productId: product.id, nameKa: "ზომა", nameEn: "Size", sortOrder: 0 },
      select: { id: true },
    });

    for (const [index, label] of shoe.sizes.entries()) {
      const value = await prisma.productOptionValue.create({
        data: { optionId: option.id, valueKa: label, valueEn: label, sortOrder: index },
        select: { id: true },
      });
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${shoe.sku}-${label.replace(/[^0-9A-Za-z]/g, "")}`,
          price: null,
          stock: 0,
          isActive: true,
          sortOrder: index,
        },
        select: { id: true },
      });
      await prisma.variantValue.create({ data: { variantId: variant.id, valueId: value.id } });
    }

    console.log(`  ${shoe.sku.padEnd(18)} ${shoe.nameEn} — ${shoe.colourEn} (${shoe.sizes.length} sizes)`);
  }

  console.log(`\n${SNEAKERS.length} sneakers written, all switched off.`);
  console.log("Each one still needs: photographs, a selling price, a cost price and stock.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
