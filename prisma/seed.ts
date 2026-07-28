/**
 * Seeds a demo catalog. Safe to re-run: everything is upserted by slug, so
 * existing rows are refreshed rather than duplicated. Orders are only created
 * when the table is empty, so demo orders don't pile up on every run.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { OrderStatus } from "../src/generated/prisma/enums";
import { hashPassword } from "../src/lib/auth-hash";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "../src/lib/cart-rules";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Every product uses the same sample photo — swap per-product in the admin. */
const IMAGE = "/products/placeholder.svg";

const categories = [
  { slug: "electronics", nameKa: "ელექტრონიკა", nameEn: "Electronics", icon: "🔌", sortOrder: 1 },
  { slug: "phones", nameKa: "ტელეფონები და აქსესუარები", nameEn: "Phones & accessories", icon: "📱", sortOrder: 2 },
  { slug: "audio", nameKa: "აუდიო", nameEn: "Audio", icon: "🎧", sortOrder: 3 },
  { slug: "home", nameKa: "სახლი და სამზარეულო", nameEn: "Home & kitchen", icon: "🏠", sortOrder: 4 },
  { slug: "tools", nameKa: "ხელსაწყოები", nameEn: "Tools", icon: "🔧", sortOrder: 5 },
  { slug: "beauty", nameKa: "სილამაზე და მოვლა", nameEn: "Beauty & care", icon: "💄", sortOrder: 6 },
  { slug: "sport", nameKa: "სპორტი და დასვენება", nameEn: "Sports & outdoor", icon: "🏕️", sortOrder: 7 },
  { slug: "auto", nameKa: "ავტო აქსესუარები", nameEn: "Car accessories", icon: "🚗", sortOrder: 8 },
];

type SeedProduct = {
  slug: string;
  nameKa: string;
  nameEn: string;
  descriptionKa: string;
  descriptionEn: string;
  price: number;
  oldPrice?: number;
  stock: number;
  brand: string;
  shippingDays: number;
  isFeatured?: boolean;
  category: string;
};

const products: SeedProduct[] = [
  /* ---------------------------- electronics ---------------------------- */
  {
    slug: "mi-smart-band-9",
    nameKa: "Xiaomi Smart Band 9 სამაჯური",
    nameEn: "Xiaomi Smart Band 9 fitness tracker",
    descriptionKa:
      "1.62 დიუმიანი AMOLED ეკრანი, პულსისა და ჟანგბადის მონიტორინგი, 21 დღემდე ბატარეა და 150+ სავარჯიშო რეჟიმი. წყალგაუმტარი 5ATM სტანდარტით.",
    descriptionEn:
      "1.62-inch AMOLED display, heart-rate and SpO2 monitoring, up to 21 days of battery and 150+ workout modes. Water resistant to 5ATM.",
    price: 129,
    oldPrice: 169,
    stock: 48,
    brand: "Xiaomi",
    shippingDays: 12,
    isFeatured: true,
    category: "electronics",
  },
  {
    slug: "tuya-smart-plug-16a",
    nameKa: "Tuya ჭკვიანი როზეტი 16A",
    nameEn: "Tuya smart plug 16A",
    descriptionKa:
      "მართე ნებისმიერი მოწყობილობა ტელეფონიდან. ენერგიის მოხმარების აღრიცხვა, ტაიმერი და განრიგი. თავსებადია Alexa-სთან და Google Home-თან.",
    descriptionEn:
      "Control any appliance from your phone. Energy metering, timers and schedules. Works with Alexa and Google Home.",
    price: 39,
    oldPrice: 55,
    stock: 120,
    brand: "Tuya",
    shippingDays: 14,
    category: "electronics",
  },
  {
    slug: "sonoff-zigbee-hub",
    nameKa: "SONOFF ZigBee 3.0 ჰაბი",
    nameEn: "SONOFF ZigBee 3.0 hub",
    descriptionKa:
      "ჭკვიანი სახლის ცენტრი — 128-მდე მოწყობილობა ერთ ქსელში. ლოკალური სცენარები მუშაობს ინტერნეტის გარეშეც.",
    descriptionEn:
      "Smart-home bridge for up to 128 devices on one network. Local scenes keep running even without internet.",
    price: 89,
    stock: 34,
    brand: "SONOFF",
    shippingDays: 15,
    category: "electronics",
  },
  {
    slug: "ugreen-usb-c-hub-9in1",
    nameKa: "UGREEN 9-in-1 USB-C ჰაბი",
    nameEn: "UGREEN 9-in-1 USB-C hub",
    descriptionKa:
      "HDMI 4K@60Hz, 3x USB 3.0, SD/TF წამკითხველი, RJ45 გიგაბიტი და 100W დამუხტვა. ალუმინის კორპუსი.",
    descriptionEn:
      "HDMI 4K@60Hz, 3x USB 3.0, SD/TF reader, gigabit RJ45 and 100W pass-through charging. Aluminium body.",
    price: 165,
    oldPrice: 199,
    stock: 27,
    brand: "UGREEN",
    shippingDays: 12,
    isFeatured: true,
    category: "electronics",
  },
  {
    slug: "creality-ender-3-v3-se",
    nameKa: "Creality Ender-3 V3 SE 3D პრინტერი",
    nameEn: "Creality Ender-3 V3 SE 3D printer",
    descriptionKa:
      "ავტომატური კალიბრაცია, 250მმ/წმ ბეჭდვის სიჩქარე, 220x220x250მმ სამუშაო არე. აწყობილია 20 წუთში.",
    descriptionEn:
      "Auto bed levelling, 250mm/s print speed, 220x220x250mm build volume. Assembles in 20 minutes.",
    price: 749,
    oldPrice: 899,
    stock: 8,
    brand: "Creality",
    shippingDays: 21,
    category: "electronics",
  },
  {
    slug: "fnirsi-dso152-oscilloscope",
    nameKa: "FNIRSI DSO152 ციფრული ოსცილოსკოპი",
    nameEn: "FNIRSI DSO152 digital oscilloscope",
    descriptionKa: "200kHz გამტარუნარიანობა, 2.5MS/s დისკრეტიზაცია, ჩაშენებული ბატარეა და ფერადი ეკრანი.",
    descriptionEn: "200kHz bandwidth, 2.5MS/s sampling, built-in battery and a colour display.",
    price: 119,
    stock: 19,
    brand: "FNIRSI",
    shippingDays: 16,
    category: "electronics",
  },

  /* ------------------------------- phones ------------------------------ */
  {
    slug: "anker-powercore-20000",
    nameKa: "Anker PowerCore 20000mAh პაუერბანკი",
    nameEn: "Anker PowerCore 20000mAh power bank",
    descriptionKa:
      "20000mAh ტევადობა, 65W USB-C PD გამომავალი — მუხტავს ლეპტოპსაც. სამი პორტი ერთდროული დამუხტვისთვის.",
    descriptionEn:
      "20000mAh capacity with a 65W USB-C PD output that charges laptops too. Three ports for simultaneous charging.",
    price: 149,
    oldPrice: 189,
    stock: 62,
    brand: "Anker",
    shippingDays: 12,
    isFeatured: true,
    category: "phones",
  },
  {
    slug: "baseus-65w-gan-charger",
    nameKa: "Baseus GaN 65W დამტენი",
    nameEn: "Baseus GaN 65W charger",
    descriptionKa: "სამპორტიანი GaN დამტენი — ჩვეულებრივზე 40%-ით პატარა. სწრაფად მუხტავს ლეპტოპს, ტელეფონსა და ყურსასმენს ერთდროულად.",
    descriptionEn: "Three-port GaN charger, 40% smaller than a standard brick. Fast-charges a laptop, phone and earbuds at once.",
    price: 79,
    oldPrice: 99,
    stock: 85,
    brand: "Baseus",
    shippingDays: 13,
    category: "phones",
  },
  {
    slug: "hoco-magsafe-powerbank-10000",
    nameKa: "Hoco MagSafe უსადენო პაუერბანკი 10000mAh",
    nameEn: "Hoco MagSafe wireless power bank 10000mAh",
    descriptionKa: "მაგნიტური მიმაგრება iPhone-ზე, 15W უსადენო და 20W სადენიანი დამუხტვა. ჩაშენებული სადგამი.",
    descriptionEn: "Magnetic snap-on for iPhone, 15W wireless and 20W wired charging. Built-in kickstand.",
    price: 95,
    stock: 41,
    brand: "Hoco",
    shippingDays: 14,
    category: "phones",
  },
  {
    slug: "ugreen-usbc-cable-2m",
    nameKa: "UGREEN USB-C 100W კაბელი 2მ",
    nameEn: "UGREEN USB-C 100W cable 2m",
    descriptionKa: "ნეილონის წნული, 100W დენი და 480Mbps გადაცემა. გამძლეობა 20 000 მოხრაზე ტესტირებული.",
    descriptionEn: "Braided nylon, 100W power delivery and 480Mbps transfer. Tested to 20,000 bends.",
    price: 25,
    oldPrice: 35,
    stock: 210,
    brand: "UGREEN",
    shippingDays: 12,
    category: "phones",
  },
  {
    slug: "remax-phone-holder-magnetic",
    nameKa: "Remax მაგნიტური სამაგრი ავტომობილისთვის",
    nameEn: "Remax magnetic car phone holder",
    descriptionKa: "N52 მაგნიტები, 360° ბრუნვა, ვენტილაციის ცხაურზე მაგრდება. ტელეფონი ერთი ხელით იდება.",
    descriptionEn: "N52 magnets, 360° rotation, clips to the air vent. One-handed phone mounting.",
    price: 29,
    stock: 154,
    brand: "Remax",
    shippingDays: 15,
    category: "phones",
  },
  {
    slug: "esr-tempered-glass-pack",
    nameKa: "ESR დამცავი შუშა (3 ცალი)",
    nameEn: "ESR tempered glass 3-pack",
    descriptionKa: "9H სიმტკიცე, ოლეოფობური საფარი და დამაგრების ჩარჩო კომპლექტში — ბუშტების გარეშე დაიდება.",
    descriptionEn: "9H hardness, oleophobic coating and an alignment frame in the box for a bubble-free fit.",
    price: 22,
    oldPrice: 32,
    stock: 176,
    brand: "ESR",
    shippingDays: 13,
    category: "phones",
  },

  /* -------------------------------- audio ------------------------------ */
  {
    slug: "qcy-t13-anc",
    nameKa: "QCY T13 ANC უსადენო ყურსასმენი",
    nameEn: "QCY T13 ANC wireless earbuds",
    descriptionKa: "აქტიური ხმაურის ჩახშობა 28dB-მდე, Bluetooth 5.3, 40 საათი ქეისთან ერთად და 4 მიკროფონი ზარებისთვის.",
    descriptionEn: "Active noise cancelling up to 28dB, Bluetooth 5.3, 40 hours with the case and 4 mics for calls.",
    price: 89,
    oldPrice: 119,
    stock: 93,
    brand: "QCY",
    shippingDays: 13,
    isFeatured: true,
    category: "audio",
  },
  {
    slug: "haylou-solar-plus",
    nameKa: "Haylou Solar Plus ჭკვიანი საათი",
    nameEn: "Haylou Solar Plus smart watch",
    descriptionKa: "1.43″ AMOLED, Bluetooth ზარები, 100+ სპორტული რეჟიმი და 14 დღიანი ბატარეა.",
    descriptionEn: "1.43″ AMOLED, Bluetooth calling, 100+ sport modes and 14-day battery life.",
    price: 139,
    stock: 57,
    brand: "Haylou",
    shippingDays: 14,
    category: "audio",
  },
  {
    slug: "tribit-stormbox-flow",
    nameKa: "Tribit StormBox Flow დინამიკი",
    nameEn: "Tribit StormBox Flow speaker",
    descriptionKa: "30W სიმძლავრე, IP67 წყალგაუმტარობა, 30 საათი დაკვრა და ორი დინამიკის დაწყვილება სტერეოსთვის.",
    descriptionEn: "30W output, IP67 waterproofing, 30 hours of playback and stereo pairing of two units.",
    price: 175,
    oldPrice: 219,
    stock: 23,
    brand: "Tribit",
    shippingDays: 15,
    category: "audio",
  },
  {
    slug: "fifine-am8-microphone",
    nameKa: "FIFINE AM8 დინამიკური მიკროფონი",
    nameEn: "FIFINE AM8 dynamic microphone",
    descriptionKa: "USB და XLR ორმაგი კავშირი, RGB განათება, ჩაშენებული ყურსასმენის გამომავალი სტრიმინგისთვის.",
    descriptionEn: "Dual USB and XLR connection, RGB lighting and a built-in headphone output for streaming.",
    price: 199,
    stock: 16,
    brand: "FIFINE",
    shippingDays: 16,
    category: "audio",
  },
  {
    slug: "soundpeats-air4-pro",
    nameKa: "SoundPEATS Air4 Pro ყურსასმენი",
    nameEn: "SoundPEATS Air4 Pro earbuds",
    descriptionKa: "ადაპტური ANC, LDAC კოდეკი მაღალი გარჩევადობის ხმისთვის და უსადენო დამუხტვა.",
    descriptionEn: "Adaptive ANC, LDAC codec for hi-res audio and wireless charging.",
    price: 149,
    oldPrice: 185,
    stock: 38,
    brand: "SoundPEATS",
    shippingDays: 14,
    category: "audio",
  },

  /* -------------------------------- home ------------------------------- */
  {
    slug: "deerma-vacuum-vc20",
    nameKa: "Deerma VC20 უსადენო მტვერსასრუტი",
    nameEn: "Deerma VC20 cordless vacuum",
    descriptionKa: "15kPa შეწოვის ძალა, 45 წუთი მუშაობა, HEPA ფილტრი და მრავალფუნქციური ჯაგრისები კომპლექტში.",
    descriptionEn: "15kPa suction, 45 minutes of runtime, a HEPA filter and a full set of brush heads included.",
    price: 289,
    oldPrice: 359,
    stock: 21,
    brand: "Deerma",
    shippingDays: 18,
    isFeatured: true,
    category: "home",
  },
  {
    slug: "xiaomi-air-fryer-6l",
    nameKa: "Xiaomi Smart Air Fryer 6L",
    nameEn: "Xiaomi Smart Air Fryer 6L",
    descriptionKa: "6 ლიტრი, 40-200°C დიაპაზონი, აპლიკაციით მართვა და 100+ ჩაშენებული რეცეპტი.",
    descriptionEn: "6 litres, 40-200°C range, app control and 100+ built-in recipes.",
    price: 319,
    stock: 29,
    brand: "Xiaomi",
    shippingDays: 18,
    category: "home",
  },
  {
    slug: "hilife-steam-iron",
    nameKa: "HiLife ხელის ორთქლის უთო",
    nameEn: "HiLife handheld garment steamer",
    descriptionKa: "30 წამში მზადაა, 240მლ რეზერვუარი და უსაფრთხო გამორთვა გადახურებისას. მოგზაურობისთვის იდეალური.",
    descriptionEn: "Ready in 30 seconds, 240ml tank and auto shut-off on overheat. Ideal for travel.",
    price: 69,
    oldPrice: 89,
    stock: 74,
    brand: "HiLife",
    shippingDays: 16,
    category: "home",
  },
  {
    slug: "led-strip-rgbic-10m",
    nameKa: "RGBIC LED ლენტი 10მ",
    nameEn: "RGBIC LED strip 10m",
    descriptionKa: "მისამართებადი დიოდები, მუსიკის რიტმზე სინქრონიზაცია და აპლიკაციით მართვა. წებოვანი 3M ფენა.",
    descriptionEn: "Addressable LEDs, music sync and app control. 3M adhesive backing.",
    price: 45,
    oldPrice: 65,
    stock: 132,
    brand: "Lepro",
    shippingDays: 15,
    category: "home",
  },
  {
    slug: "ceramic-knife-set-5",
    nameKa: "კერამიკული დანების ნაკრები (5 ცალი)",
    nameEn: "Ceramic knife set (5 pieces)",
    descriptionKa: "ცირკონიუმის კერამიკა — არ ჟანგდება და სიმახვილეს დიდხანს ინარჩუნებს. სადგამი კომპლექტში.",
    descriptionEn: "Zirconium ceramic that never rusts and holds its edge far longer than steel. Stand included.",
    price: 79,
    stock: 46,
    brand: "Huohou",
    shippingDays: 17,
    category: "home",
  },
  {
    slug: "mijia-thermometer-hygrometer",
    nameKa: "Mijia ჭკვიანი თერმომეტრი-ჰიგრომეტრი",
    nameEn: "Mijia smart thermometer & hygrometer",
    descriptionKa: "E-ink ეკრანი, Bluetooth სინქრონიზაცია და ერთწლიანი ბატარეა. ისტორია აპლიკაციაში ინახება.",
    descriptionEn: "E-ink display, Bluetooth sync and a full year of battery. History is stored in the app.",
    price: 32,
    stock: 168,
    brand: "Xiaomi",
    shippingDays: 14,
    category: "home",
  },

  /* -------------------------------- tools ------------------------------ */
  {
    slug: "hoto-electric-screwdriver",
    nameKa: "HOTO ელექტრო სახრახნისი 12-in-1",
    nameEn: "HOTO electric screwdriver 12-in-1",
    descriptionKa: "3Nm ბრუნვის მომენტი, 12 წვერი, USB-C დამუხტვა და ალუმინის ქეისი. ჩაშენებული LED განათება.",
    descriptionEn: "3Nm torque, 12 bits, USB-C charging and an aluminium case. Built-in LED work light.",
    price: 95,
    oldPrice: 125,
    stock: 52,
    brand: "HOTO",
    shippingDays: 15,
    isFeatured: true,
    category: "tools",
  },
  {
    slug: "deli-laser-level-16-line",
    nameKa: "Deli ლაზერული ნიველირი 16 ხაზი",
    nameEn: "Deli laser level 16 lines",
    descriptionKa: "მწვანე ლაზერი, 4x360° პროექცია, თვითნიველირება და 30 მეტრი დაფარვის რადიუსი.",
    descriptionEn: "Green laser, 4x360° projection, self-levelling and a 30-metre working radius.",
    price: 265,
    stock: 14,
    brand: "Deli",
    shippingDays: 19,
    category: "tools",
  },
  {
    slug: "jakemy-precision-kit-180",
    nameKa: "JAKEMY ზუსტი ხელსაწყოების ნაკრები (180 ცალი)",
    nameEn: "JAKEMY precision tool kit (180 pieces)",
    descriptionKa: "S2 ფოლადის წვერები ტელეფონის, ლეპტოპისა და კონსოლის შესაკეთებლად. მაგნიტური სამუშაო ხალიჩა კომპლექტში.",
    descriptionEn: "S2 steel bits for phone, laptop and console repair. Magnetic work mat included.",
    price: 88,
    oldPrice: 110,
    stock: 39,
    brand: "JAKEMY",
    shippingDays: 16,
    category: "tools",
  },
  {
    slug: "nicron-b71-flashlight",
    nameKa: "Nicron B71 LED ფარანი",
    nameEn: "Nicron B71 LED flashlight",
    descriptionKa: "1000 ლუმენი, 90° მოხრადი თავი, მაგნიტური ფუძე და USB-C დამუხტვა. IP65 დაცვა.",
    descriptionEn: "1000 lumens, 90° rotating head, magnetic base and USB-C charging. IP65 rated.",
    price: 58,
    stock: 88,
    brand: "Nicron",
    shippingDays: 15,
    category: "tools",
  },
  {
    slug: "mustool-digital-multimeter",
    nameKa: "MUSTOOL ციფრული მულტიმეტრი True RMS",
    nameEn: "MUSTOOL digital multimeter True RMS",
    descriptionKa: "ავტომატური დიაპაზონი, True RMS გაზომვა, ტემპერატურა და უკონტაქტო ძაბვის დეტექტორი.",
    descriptionEn: "Auto-ranging, True RMS measurement, temperature probe and non-contact voltage detection.",
    price: 72,
    oldPrice: 92,
    stock: 63,
    brand: "MUSTOOL",
    shippingDays: 16,
    category: "tools",
  },

  /* ------------------------------- beauty ------------------------------ */
  {
    slug: "dreame-hair-dryer",
    nameKa: "Dreame Glory ფენი",
    nameEn: "Dreame Glory hair dryer",
    descriptionKa: "110 000 ბრ/წთ ძრავი, უარყოფითი იონები და ტემპერატურის კონტროლი წამში 200-ჯერ.",
    descriptionEn: "110,000rpm motor, negative ions and temperature control 200 times per second.",
    price: 259,
    oldPrice: 329,
    stock: 26,
    brand: "Dreame",
    shippingDays: 17,
    category: "beauty",
  },
  {
    slug: "soocas-x3-pro-toothbrush",
    nameKa: "SOOCAS X3 Pro ელექტრო კბილის ჯაგრისი",
    nameEn: "SOOCAS X3 Pro electric toothbrush",
    descriptionKa: "ხმოვანი ვიბრაცია 39 600/წთ, 4 რეჟიმი, 30 დღიანი ბატარეა და მოგზაურობის ქეისი.",
    descriptionEn: "Sonic vibration at 39,600/min, 4 modes, 30-day battery and a travel case.",
    price: 115,
    stock: 58,
    brand: "SOOCAS",
    shippingDays: 15,
    category: "beauty",
  },
  {
    slug: "wellskins-ipl-hair-removal",
    nameKa: "WellSkins IPL ეპილატორი",
    nameEn: "WellSkins IPL hair removal device",
    descriptionKa: "999 000 ციმციმი, 5 დონე და კანის ტონის სენსორი. შედეგი 4-6 კვირაში.",
    descriptionEn: "999,000 flashes, 5 intensity levels and a skin-tone sensor. Results in 4-6 weeks.",
    price: 289,
    oldPrice: 379,
    stock: 17,
    brand: "WellSkins",
    shippingDays: 18,
    category: "beauty",
  },
  {
    slug: "showsee-nose-trimmer",
    nameKa: "ShowSee ცხვირის თმის სამართებელი",
    nameEn: "ShowSee nose hair trimmer",
    descriptionKa: "უჟანგავი ფოლადის ორმაგი პირი, წყალგაუმტარი კორპუსი და ერთი AA ელემენტი 6 თვის მუშაობისთვის.",
    descriptionEn: "Stainless dual-blade head, washable body and a single AA cell that lasts six months.",
    price: 42,
    stock: 97,
    brand: "ShowSee",
    shippingDays: 14,
    category: "beauty",
  },

  /* -------------------------------- sport ------------------------------ */
  {
    slug: "naturehike-cloud-up-2",
    nameKa: "Naturehike Cloud Up 2 კარავი",
    nameEn: "Naturehike Cloud Up 2 tent",
    descriptionKa: "ორადგილიანი, 1.8კგ წონა, 20D სილიკონის ქსოვილი და 4000მმ წყალგაუმტარობა.",
    descriptionEn: "Two-person, 1.8kg, 20D silicone-coated fabric with a 4000mm waterproof rating.",
    price: 395,
    oldPrice: 469,
    stock: 12,
    brand: "Naturehike",
    shippingDays: 20,
    isFeatured: true,
    category: "sport",
  },
  {
    slug: "yunmai-smart-scale",
    nameKa: "Yunmai ჭკვიანი სასწორი",
    nameEn: "Yunmai smart body scale",
    descriptionKa: "13 პარამეტრი — ცხიმი, კუნთი, წყალი და ძვლის მასა. მონაცემები აპლიკაციაში სინქრონდება.",
    descriptionEn: "13 body metrics including fat, muscle, water and bone mass. Syncs to the app.",
    price: 85,
    stock: 71,
    brand: "Yunmai",
    shippingDays: 15,
    category: "sport",
  },
  {
    slug: "merach-resistance-band-set",
    nameKa: "Merach წინააღმდეგობის რეზინების ნაკრები",
    nameEn: "Merach resistance band set",
    descriptionKa: "5 დონე 45კგ-მდე, ტარების ჩანთა, კარის სამაგრი და ვარჯიშის სახელმძღვანელო.",
    descriptionEn: "5 levels up to 45kg, carry bag, door anchor and a workout guide.",
    price: 49,
    oldPrice: 69,
    stock: 104,
    brand: "Merach",
    shippingDays: 14,
    category: "sport",
  },
  {
    slug: "rockbros-cycling-glasses",
    nameKa: "RockBros ველოსიპედის სათვალე",
    nameEn: "RockBros cycling glasses",
    descriptionKa: "პოლარიზებული ლინზები, UV400 დაცვა და 3 ცვლადი ფილტრი. ულტრამსუბუქი TR90 ჩარჩო.",
    descriptionEn: "Polarised lenses, UV400 protection and 3 interchangeable filters. Ultralight TR90 frame.",
    price: 65,
    stock: 83,
    brand: "RockBros",
    shippingDays: 16,
    category: "sport",
  },

  /* --------------------------------- auto ------------------------------ */
  {
    slug: "70mai-dash-cam-a510",
    nameKa: "70mai A510 ვიდეორეგისტრატორი",
    nameEn: "70mai A510 dash cam",
    descriptionKa: "2.7K ჩაწერა, ღამის ხედვა, GPS და პარკინგის მონიტორინგი. უკანა კამერის მხარდაჭერა.",
    descriptionEn: "2.7K recording, night vision, GPS and parking surveillance. Supports a rear camera.",
    price: 229,
    oldPrice: 289,
    stock: 31,
    brand: "70mai",
    shippingDays: 15,
    isFeatured: true,
    category: "auto",
  },
  {
    slug: "baseus-car-vacuum",
    nameKa: "Baseus ავტომობილის მტვერსასრუტი",
    nameEn: "Baseus car vacuum cleaner",
    descriptionKa: "16000Pa შეწოვა, უსადენო, 3 დამატებითი საქშენი და HEPA ფილტრი.",
    descriptionEn: "16000Pa suction, cordless, three extra nozzles and a washable HEPA filter.",
    price: 119,
    stock: 47,
    brand: "Baseus",
    shippingDays: 15,
    category: "auto",
  },
  {
    slug: "carsun-tire-inflator",
    nameKa: "Carsun ციფრული კომპრესორი",
    nameEn: "Carsun digital tyre inflator",
    descriptionKa: "150PSI, ავტომატური გამორთვა სასურველ წნევაზე, LED ფარანი და 12V შტეფსელი.",
    descriptionEn: "150PSI, auto shut-off at the target pressure, LED light and a 12V plug.",
    price: 89,
    oldPrice: 115,
    stock: 66,
    brand: "Carsun",
    shippingDays: 16,
    category: "auto",
  },
  {
    slug: "jump-starter-12000mah",
    nameKa: "სტარტერი-პაუერბანკი 12000mAh",
    nameEn: "Jump starter power bank 12000mAh",
    descriptionKa: "600A პიკური დენი, 6.0L ბენზინის ძრავის დასაქოქად. ასევე მუშაობს პაუერბანკად და ფარნად.",
    descriptionEn: "600A peak current, starts petrol engines up to 6.0L. Doubles as a power bank and torch.",
    price: 179,
    stock: 24,
    brand: "Utrai",
    shippingDays: 17,
    category: "auto",
  },
];


/* ------------------------------------------------------------------ */
/* Order generation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Deterministic PRNG (mulberry32). Re-running the seed must produce the same
 * catalogue and the same sales history, otherwise every run would change the
 * dashboard's numbers.
 */
function makeRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const customerPool = [
  { name: "ნინო ბერიძე", phone: "+995 599 12 34 56", city: "თბილისი", address: "ვაჟა-ფშაველას გამზ. 76, ბინა 12" },
  { name: "გიორგი მაისურაძე", phone: "+995 577 88 90 21", city: "ბათუმი", address: "ჭავჭავაძის ქ. 31" },
  { name: "ანა კვარაცხელია", phone: "+995 555 40 11 09", city: "ქუთაისი", address: "თამარ მეფის ქ. 8" },
  { name: "ლევან ჩხეიძე", phone: "+995 598 76 54 32", city: "რუსთავი", address: "მეგობრობის გამზ. 14" },
  { name: "მარიამ გელაშვილი", phone: "+995 591 22 33 44", city: "თბილისი", address: "პეკინის ქ. 5, ბინა 40" },
  { name: "დავით ლომიძე", phone: "+995 574 65 43 21", city: "გორი", address: "სტალინის გამზ. 22" },
  { name: "სოფიო თავაძე", phone: "+995 592 10 20 30", city: "ზუგდიდი", address: "რუსთაველის ქ. 47" },
  { name: "ირაკლი ნადირაძე", phone: "+995 597 55 66 77", city: "თბილისი", address: "ალ. ყაზბეგის გამზ. 18" },
  { name: "თამარ ჯაფარიძე", phone: "+995 595 81 19 28", city: "ფოთი", address: "დავით აღმაშენებლის ქ. 3" },
  { name: "ზურაბ კიკნაძე", phone: "+995 596 44 55 66", city: "თელავი", address: "ერეკლე II-ის გამზ. 9" },
  { name: "ეკა ბოლქვაძე", phone: "+995 593 77 88 99", city: "ბათუმი", address: "გორგასალის ქ. 61" },
  { name: "ნიკა ღვინიაშვილი", phone: "+995 599 34 12 90", city: "მცხეთა", address: "არაგვის ქ. 12" },
];

/**
 * Order numbers must not be guessable: the confirmation page is reachable by
 * URL, so sequential numbers would let anyone walk the list and read every
 * buyer's name, phone and address. Same shape as `generateOrderNumber()` in
 * the checkout action, but driven by the seeded PRNG so runs stay reproducible.
 */
function seededOrderNumber(random: () => number) {
  let hex = "";
  for (let i = 0; i < 8; i++) {
    hex += Math.floor(random() * 16).toString(16).toUpperCase();
  }
  return `BZ-${hex}`;
}

const coupons = [
  { code: "WELCOME10", percentOff: 10, minOrderTotal: 50, maxUses: 500, isActive: true },
  { code: "FREESHIP", amountOff: 15, minOrderTotal: 80, maxUses: 300, isActive: true },
  { code: "SUMMER25", percentOff: 25, minOrderTotal: 200, maxUses: 100, isActive: true },
  { code: "EXPIRED5", percentOff: 5, minOrderTotal: 0, maxUses: 50, isActive: false },
];

const ORDER_COUNT = 140;
const HISTORY_DAYS = 180;

async function main() {
  console.log("→ seeding categories…");
  const categoryIdBySlug = new Map<string, string>();
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  console.log("→ seeding products…");
  type SeededProduct = {
    id: string;
    slug: string;
    nameKa: string;
    nameEn: string;
    sku: string;
    price: number;
    costPrice: number;
  };
  const seeded: SeededProduct[] = [];

  for (const [index, entry] of products.entries()) {
    const { category, ...product } = entry;
    const categoryId = categoryIdBySlug.get(category);
    if (!categoryId) throw new Error(`Unknown category "${category}" on ${product.slug}`);

    // A stable SKU and a plausible cost basis (58-68% of the sale price), both
    // derived from the index so re-seeding doesn't churn the numbers.
    const sku = `BZ-${String(index + 1).padStart(4, "0")}`;
    const margin = 0.58 + ((index * 7) % 11) / 100;
    const costPrice = Math.round(product.price * margin * 100) / 100;

    const data = {
      ...product,
      sku,
      costPrice,
      lowStockAt: 10,
      image: IMAGE,
      categoryId,
      isActive: true,
    };

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: data,
    });

    seeded.push({
      id: row.id,
      slug: row.slug,
      nameKa: row.nameKa,
      nameEn: row.nameEn,
      sku: row.sku,
      price: row.price,
      costPrice: row.costPrice,
    });
  }

  console.log("→ seeding coupons…");
  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }

  /* ---------------------------- users ------------------------------ */
  const email = process.env.ADMIN_EMAIL ?? "admin@bazari.ge";

  // No fallback on purpose: a default admin password that ships in the repo is
  // a default admin password on every deployment that forgets to override it.
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must be set to at least 12 characters before seeding.\n" +
        "Generate one with:\n" +
        '  node -e "console.log(require(\'crypto\').randomBytes(18).toString(\'base64url\'))"',
    );
  }
  const admin = await prisma.user.upsert({
    where: { email },
    update: { password: hashPassword(password), role: "admin", emailVerified: true },
    create: {
      email,
      name: "Store admin",
      password: hashPassword(password),
      role: "admin",
      emailVerified: true,
    },
  });

  // A ready-made customer, so the account area can be tried without signing up.
  const demoEmail = "user@bazari.ge";
  const demoCustomer = await prisma.user.upsert({
    where: { email: demoEmail },
    update: { password: hashPassword("user1234"), role: "customer", emailVerified: true },
    create: {
      email: demoEmail,
      name: "Demo customer",
      phone: "+995 599 00 00 00",
      city: "თბილისი",
      address: "ვაჟა-ფშაველას გამზ. 76",
      password: hashPassword("user1234"),
      role: "customer",
      emailVerified: true,
    },
  });

  /* ---------------------------- orders ----------------------------- */
  const existingOrders = await prisma.order.count();
  if (existingOrders > 0) {
    console.log(`→ skipping orders (${existingOrders} already exist)`);
  } else {
    console.log(`→ generating ${ORDER_COUNT} orders across ${HISTORY_DAYS} days…`);
    const random = makeRandom(20260726);
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    // Opening stock ledger: one restock per product, before any sale.
    await prisma.stockMovement.createMany({
      data: seeded.map((product) => ({
        productId: product.id,
        delta: 0,
        reason: "restock" as const,
        balance: 0,
        note: "Opening balance",
        createdAt: new Date(now - HISTORY_DAYS * DAY),
      })),
    });

    const couponRows = await prisma.coupon.findMany({ where: { isActive: true } });

    for (let i = 0; i < ORDER_COUNT; i++) {
      // Skew towards recent days so the dashboard's trend looks like a real
      // shop growing rather than a flat line.
      const ageDays = Math.floor(HISTORY_DAYS * random() ** 1.7);
      const createdAt = new Date(now - ageDays * DAY - Math.floor(random() * DAY));

      const person = customerPool[Math.floor(random() * customerPool.length)];
      // Roughly one order in five belongs to the demo customer's account.
      const isDemoCustomer = random() < 0.2;

      const lineCount = 1 + Math.floor(random() * 3);
      const chosen = new Set<number>();
      while (chosen.size < lineCount) chosen.add(Math.floor(random() * seeded.length));

      const lines = [...chosen].map((index) => {
        const product = seeded[index];
        return { product, quantity: 1 + Math.floor(random() * 3) };
      });

      const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
      const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

      // One order in six uses a coupon it actually qualifies for.
      let discount = 0;
      let couponId: string | null = null;
      if (random() < 0.16) {
        const eligible = couponRows.filter((c) => subtotal >= c.minOrderTotal);
        const coupon = eligible[Math.floor(random() * eligible.length)];
        if (coupon) {
          discount = coupon.percentOff
            ? Math.round(subtotal * (coupon.percentOff / 100) * 100) / 100
            : (coupon.amountOff ?? 0);
          discount = Math.min(discount, subtotal);
          couponId = coupon.id;
        }
      }

      const total = Math.round((subtotal + shipping - discount) * 100) / 100;

      // Older orders have had time to complete; recent ones are still moving.
      const roll = random();
      const status: OrderStatus =
        ageDays > 21
          ? roll < 0.9
            ? "delivered"
            : "cancelled"
          : ageDays > 10
            ? roll < 0.7
              ? "delivered"
              : roll < 0.9
                ? "shipped"
                : "cancelled"
            : ageDays > 4
              ? roll < 0.45
                ? "shipped"
                : roll < 0.85
                  ? "confirmed"
                  : "pending"
              : roll < 0.6
                ? "pending"
                : "confirmed";

      const paymentMethod =
        random() < 0.72 ? "cash_on_delivery" : random() < 0.7 ? "card" : "bank_transfer";
      const paymentStatus =
        status === "delivered" ? "paid" : status === "cancelled" ? "refunded" : "unpaid";

      const shippedAt =
        status === "shipped" || status === "delivered"
          ? new Date(createdAt.getTime() + (1 + random() * 3) * DAY)
          : null;
      const deliveredAt =
        status === "delivered"
          ? new Date(createdAt.getTime() + (4 + random() * 8) * DAY)
          : null;

      const order = await prisma.order.create({
        data: {
          number: seededOrderNumber(random),
          userId: isDemoCustomer ? demoCustomer.id : null,
          customerName: isDemoCustomer ? demoCustomer.name : person.name,
          phone: isDemoCustomer ? demoCustomer.phone : person.phone,
          email: isDemoCustomer ? demoCustomer.email : "",
          city: person.city,
          address: person.address,
          note: random() < 0.15 ? "დამირეკეთ მისვლამდე" : "",
          subtotal,
          shipping,
          discount,
          total,
          couponId,
          paymentMethod,
          paymentStatus,
          status,
          shippedAt,
          deliveredAt,
          createdAt,
          updatedAt: deliveredAt ?? shippedAt ?? createdAt,
          items: {
            create: lines.map(({ product, quantity }) => ({
              productId: product.id,
              nameKa: product.nameKa,
              nameEn: product.nameEn,
              sku: product.sku,
              image: IMAGE,
              price: product.price,
              costPrice: product.costPrice,
              quantity,
            })),
          },
        },
      });

      // Timeline: one event per status the order actually passed through.
      const timeline: { status: OrderStatus; at: Date }[] = [
        { status: "pending", at: createdAt },
      ];
      if (status !== "pending" && status !== "cancelled") {
        timeline.push({
          status: "confirmed",
          at: new Date(createdAt.getTime() + random() * DAY),
        });
      }
      if (shippedAt) timeline.push({ status: "shipped", at: shippedAt });
      if (deliveredAt) timeline.push({ status: "delivered", at: deliveredAt });
      if (status === "cancelled") {
        timeline.push({
          status: "cancelled",
          at: new Date(createdAt.getTime() + random() * 2 * DAY),
        });
      }

      await prisma.orderEvent.createMany({
        data: timeline.map((entry) => ({
          orderId: order.id,
          status: entry.status,
          actor: entry.status === "pending" ? "" : admin.email,
          createdAt: entry.at,
        })),
      });

      // Stock ledger: cancelled orders never consumed stock.
      if (status !== "cancelled") {
        for (const { product, quantity } of lines) {
          await prisma.stockMovement.create({
            data: {
              productId: product.id,
              delta: -quantity,
              reason: "sale",
              balance: 0,
              orderId: order.id,
              createdAt,
            },
          });
        }
      }
    }

    // Stock ledger balances are filled in afterwards, in date order, so each
    // row shows the level that actually followed it.
    console.log("→ reconciling stock ledger…");
    for (const product of seeded) {
      const moves = await prisma.stockMovement.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: "asc" },
      });

      const sold = moves.reduce((sum, m) => sum + (m.delta < 0 ? -m.delta : 0), 0);
      const current = await prisma.product.findUnique({
        where: { id: product.id },
        select: { stock: true },
      });

      // Opening balance = what's left now plus everything since sold.
      let balance = (current?.stock ?? 0) + sold;
      for (const move of moves) {
        if (move.reason === "restock" && move.delta === 0) {
          await prisma.stockMovement.update({
            where: { id: move.id },
            data: { delta: balance, balance },
          });
          continue;
        }
        balance += move.delta;
        await prisma.stockMovement.update({ where: { id: move.id }, data: { balance } });
      }
    }
  }

  // `usedCount` is the counter the checkout limit is enforced against, so it
  // has to agree with the orders that actually reference each coupon.
  console.log("→ reconciling coupon usage…");
  for (const coupon of await prisma.coupon.findMany({ select: { id: true } })) {
    const usedCount = await prisma.order.count({ where: { couponId: coupon.id } });
    await prisma.coupon.update({ where: { id: coupon.id }, data: { usedCount } });
  }

  const [orderCount, movementCount, couponCount] = await Promise.all([
    prisma.order.count(),
    prisma.stockMovement.count(),
    prisma.coupon.count(),
  ]);

  console.log(
    `\n✓ done — ${categories.length} categories, ${products.length} products,\n` +
      `  ${orderCount} orders, ${movementCount} stock movements, ${couponCount} coupons.\n` +
      `  admin:    ${email} / ${password}\n` +
      `  customer: ${demoEmail} / user1234\n`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
