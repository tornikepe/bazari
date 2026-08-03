/**
 * Content for the static information pages linked from the footer.
 *
 * Kept as data rather than eight hand-written page components: every entry
 * renders through the same `InfoPageView`, so the pages stay consistent and
 * adding one is a matter of adding a key here plus a three-line route file.
 *
 * The copy deliberately describes only what the application actually does.
 * This is a portfolio build with no real company behind it, so there are no
 * invented phone numbers, addresses, supplier claims or guarantees — the rules
 * mentioned here (free-shipping threshold, cash on delivery) are the ones the
 * code really enforces.
 */
import type { Locale } from "@/lib/i18n";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/cart-rules";

type Section = { heading: string; body: string[] };
type Content = { title: string; intro: string; sections: Section[] };

export type InfoSlug =
  | "about"
  | "contact"
  | "faq"
  | "shipping"
  | "returns"
  | "warranty"
  | "terms"
  | "privacy";

const pages: Record<InfoSlug, Record<Locale, Content>> = {
  about: {
    ka: {
      title: "ჩვენ შესახებ",
      intro:
        "Bazari არის ონლაინ მაღაზიის დემო — სასწავლო და საპორტფოლიო პროექტი, რომელიც სრულ e-commerce ნაკადს აჩვენებს.",
      sections: [
        {
          heading: "რა არის ეს პროექტი",
          body: [
            "ეს არის სრულფასოვანი ონლაინ მაღაზიის აპლიკაცია: კატალოგი ფილტრებით, კალათა, შეკვეთის გაფორმება, შეკვეთის ძებნა და ადმინ პანელი.",
            "ის რეალურ კომპანიას არ ეკუთვნის და ნამდვილ გაყიდვებს არ ემსახურება. ყველა პროდუქტი, ფასი და შეკვეთა სატესტო მონაცემია.",
          ],
        },
        {
          heading: "რა მუშაობს ნამდვილად",
          body: [
            "კატალოგის ფილტრები, ძებნა, კალათა, რჩეულები და შეკვეთის გაფორმება ნამდვილად მუშაობს — შეკვეთა ბაზაში ინახება.",
            "ადმინ პანელიდან პროდუქტების, კატეგორიებისა და შეკვეთების მართვა რეალურად ცვლის მონაცემებს.",
          ],
        },
      ],
    },
    en: {
      title: "About us",
      intro:
        "Bazari is an online-store demo — a learning and portfolio project that shows a complete e-commerce flow.",
      sections: [
        {
          heading: "What this project is",
          body: [
            "A full online-store application: a filterable catalog, cart, checkout, order tracking and an admin panel.",
            "It does not belong to a real company and does not serve real sales. Every product, price and order is sample data.",
          ],
        },
        {
          heading: "What actually works",
          body: [
            "Catalog filtering, search, cart, wishlist and checkout all genuinely work — orders are written to the database.",
            "Managing products, categories and orders from the admin panel really does change the data.",
          ],
        },
      ],
    },
  },

  contact: {
    ka: {
      title: "კონტაქტი",
      intro: "ეს დემო პროექტია — რეალური მხარდაჭერის სამსახური მას არ აქვს.",
      sections: [
        {
          heading: "შეკვეთის სტატუსი",
          body: [
            "შეკვეთის სტატუსის სანახავად გამოიყენე გვერდი „შეკვეთის მოძებნა“ — დაგჭირდება შეკვეთის ნომერი და ტელეფონი, რომელიც შეკვეთისას მიუთითე.",
          ],
        },
        {
          heading: "პროექტის ავტორი",
          body: [
            "კოდი ღიაა GitHub-ზე: github.com/tornikepe",
            "შენიშვნები და შეკითხვები იქვე, issue-ს სახით მიიღება.",
          ],
        },
      ],
    },
    en: {
      title: "Contact",
      intro: "This is a demo project — there is no real support desk behind it.",
      sections: [
        {
          heading: "Order status",
          body: [
            "To check an order, use the “Track your order” page — you'll need the order number and the phone number you entered at checkout.",
          ],
        },
        {
          heading: "Project author",
          body: [
            "The source is on GitHub: github.com/tornikepe",
            "Questions and notes are welcome there as issues.",
          ],
        },
      ],
    },
  },

  faq: {
    ka: {
      title: "ხშირად დასმული კითხვები",
      intro: "კითხვები შეკვეთაზე, მიწოდებასა და ამ პროექტის ბუნებაზე.",
      sections: [
        {
          heading: "ეს ნამდვილი მაღაზიაა?",
          body: [
            "არა. ეს საპორტფოლიო დემოა. შეკვეთა ბაზაში ინახება, მაგრამ არაფერი იგზავნება და გადახდა არ ხდება.",
          ],
        },
        {
          heading: "რეგისტრაცია მჭირდება?",
          body: ["არა. შეკვეთის გასაფორმებლად საკმარისია სახელი, ტელეფონი და მისამართი."],
        },
        {
          heading: "როგორ ვნახო ჩემი შეკვეთა?",
          body: [
            "გვერდზე „შეკვეთის მოძებნა“ შეიყვანე შეკვეთის ნომერი და ტელეფონი. ტელეფონი საჭიროა იმისთვის, რომ სხვისმა შეკვეთამ ხელში არ ჩაგივარდეს.",
          ],
        },
      ],
    },
    en: {
      title: "Frequently asked questions",
      intro: "Questions about ordering, delivery and what this project is.",
      sections: [
        {
          heading: "Is this a real shop?",
          body: [
            "No. It's a portfolio demo. Orders are stored in the database, but nothing ships and no payment is taken.",
          ],
        },
        {
          heading: "Do I need an account?",
          body: ["No. A name, phone number and address are all checkout asks for."],
        },
        {
          heading: "How do I find my order?",
          body: [
            "On the “Track your order” page, enter the order number and your phone. The phone is required so that someone else's order can't be looked up.",
          ],
        },
      ],
    },
  },

  shipping: {
    ka: {
      title: "მიწოდება",
      intro: "მიწოდების წესები, რომლებსაც აპლიკაცია ნამდვილად იყენებს.",
      sections: [
        {
          heading: "ღირებულება",
          body: [
            `მიწოდება უფასოა ${FREE_SHIPPING_THRESHOLD} ₾-ზე მეტ შეკვეთაზე. სხვა შემთხვევაში — ${SHIPPING_FEE} ₾.`,
            "ეს თანხა კალათაშივე ჩანს და შეკვეთის ჯამში სერვერზე ითვლება.",
          ],
        },
        {
          heading: "ვადები",
          body: [
            "მიწოდების სავარაუდო ვადა თითოეულ პროდუქტზეა მითითებული და ადმინ პანელიდან იმართება.",
          ],
        },
      ],
    },
    en: {
      title: "Shipping",
      intro: "The delivery rules the application actually applies.",
      sections: [
        {
          heading: "Cost",
          body: [
            `Delivery is free on orders over ₾${FREE_SHIPPING_THRESHOLD}, otherwise ₾${SHIPPING_FEE}.`,
            "The amount is shown in the cart and recalculated on the server when the order is placed.",
          ],
        },
        {
          heading: "Timelines",
          body: [
            "The delivery estimate is set per product and managed from the admin panel.",
          ],
        },
      ],
    },
  },

  returns: {
    ka: {
      title: "დაბრუნების პოლიტიკა",
      intro: "დემო პროექტს რეალური დაბრუნების პროცესი არ აქვს.",
      sections: [
        {
          heading: "როგორ იქნებოდა რეალურ მაღაზიაში",
          body: [
            "რეალურ მაღაზიაში აქ ეწერებოდა დაბრუნების ვადა, პროდუქტის მდგომარეობის მოთხოვნები და თანხის დაბრუნების პროცედურა.",
            "ვინაიდან აქ გადახდა არ ხდება, დასაბრუნებელიც არაფერია.",
          ],
        },
      ],
    },
    en: {
      title: "Return policy",
      intro: "A demo project has no real returns process.",
      sections: [
        {
          heading: "What a real shop would put here",
          body: [
            "A real store would state its return window, the condition requirements and how refunds are issued.",
            "Since no payment is taken here, there is nothing to return.",
          ],
        },
      ],
    },
  },

  warranty: {
    ka: {
      title: "გარანტია",
      intro: "დემო პროექტს გარანტიის რეალური ვალდებულება არ აქვს.",
      sections: [
        {
          heading: "რას ნიშნავს ეს",
          body: [
            "ამ გვერდზე რეალური მაღაზია მიუთითებდა გარანტიის ვადებს და სერვისცენტრის მისამართს.",
            "აქ ასეთი ვალდებულება არ არსებობს — პროდუქტები სატესტო მონაცემია.",
          ],
        },
      ],
    },
    en: {
      title: "Warranty",
      intro: "A demo project carries no real warranty obligation.",
      sections: [
        {
          heading: "What this means",
          body: [
            "A real store would list warranty periods and a service-centre address here.",
            "No such obligation exists here — the products are sample data.",
          ],
        },
      ],
    },
  },

  terms: {
    ka: {
      title: "წესები და პირობები",
      intro: "მოკლედ იმაზე, რას წარმოადგენს ეს საიტი.",
      sections: [
        {
          heading: "დემო სტატუსი",
          body: [
            "საიტი სასწავლო/საპორტფოლიო პროექტია. მასზე გაფორმებული შეკვეთა იურიდიულ ვალდებულებას არ წარმოშობს.",
            "პროდუქტები, ფასები და მარაგი სატესტო მონაცემია და ნებისმიერ დროს შეიძლება შეიცვალოს.",
          ],
        },
        {
          heading: "ფასები",
          body: ["ფასები მითითებულია ლარში. გადახდა არ მუშაობს."],
        },
      ],
    },
    en: {
      title: "Terms & conditions",
      intro: "A short note on what this site is.",
      sections: [
        {
          heading: "Demo status",
          body: [
            "This site is a learning / portfolio project. Placing an order here creates no legal obligation.",
            "Products, prices and stock are sample data and may change at any time.",
          ],
        },
        {
          heading: "Prices",
          body: ["Prices are in Georgian lari. Payment is not implemented."],
        },
      ],
    },
  },

  privacy: {
    ka: {
      title: "კონფიდენციალურობა",
      intro: "რა მონაცემებს ინახავს აპლიკაცია სინამდვილეში, სად მიდის და რამდენ ხანს.",
      sections: [
        {
          heading: "რას ვინახავთ",
          body: [
            "შეკვეთის გაფორმებისას ბაზაში ინახება სახელი, ტელეფონი, ქალაქი, მისამართი, კომენტარი და — თუ შეავსებ — ელფოსტა.",
            "ანგარიშის შექმნისას: ელფოსტა, სახელი, ტელეფონი და პაროლის კრიპტოგრაფიული ჰეში. პაროლი ღია ტექსტად არასდროს ინახება.",
            "კალათა და რჩეულები მხოლოდ შენს ბრაუზერშია (localStorage) და სერვერზე არ იგზავნება.",
          ],
        },
        {
          heading: "Cookie-ები",
          body: [
            "bz_session — შესვლის სესია, ხელმოწერილი, httpOnly, 7 დღე. მისი გარეშე ანგარიშში შესვლა შეუძლებელია.",
            "bz_receipts — ხელმოწერილი სია იმ შეკვეთების, რომლებიც ამ ბრაუზერიდან გააფორმე, 30 დღე. ის უზრუნველყოფს, რომ შენს შეკვეთას მხოლოდ შენ ხედავ.",
            "cm_locale — არჩეული ენა. bz_theme — არჩეული თემა. ერთი წელი.",
            "ანალიტიკის ან რეკლამის cookie არ გვაქვს, ამიტომ თანხმობის ფანჯარაც არ არის საჭირო.",
          ],
        },
        {
          heading: "ვის გადაეცემა",
          body: [
            "Vercel — ჰოსტინგი. ამუშავებს ყველა მოთხოვნას და ინახავს სერვერის ლოგებს (IP მისამართი, გვერდი, დრო).",
            "Prisma Postgres — ბაზა. აქ ინახება შეკვეთები და ანგარიშები.",
            "Resend — ელფოსტის გაგზავნა. იღებს მიმღების მისამართს და წერილის შიგთავსს (დადასტურების კოდი, შეკვეთის დეტალები).",
            "Google (Gemini) — საიტის ჩატ-ასისტენტი. იღებს შენს შეტყობინებას და პასუხისთვის საჭირო მონაცემებს კატალოგიდან. თუ შეკვეთის სტატუსს ჰკითხავ, გადაეცემა ამ შეკვეთის სტატუსი, ნივთები, თანხა და ქალაქი — სახელი, ტელეფონი და მისამართი არა.",
            "მნიშვნელოვანი: ასისტენტი Google-ის უფასო დონეზე მუშაობს, სადაც Google-ის პირობებით საუბრები მისი პროდუქტების გასაუმჯობესებლად გამოიყენება. ამიტომაც: ჩატში ნამდვილი პერსონალური მონაცემები არ დაწერო.",
            "სხვა მხარეს მონაცემები არ გადაეცემა და არ იყიდება.",
          ],
        },
        {
          heading: "რამდენ ხანს",
          body: [
            "ერთჯერადი კოდები (დადასტურება, პაროლის აღდგენა) — 15 წუთი, შემდეგ ძალადაკარგულია.",
            "შეკვეთები — განუსაზღვრელი ვადით, რადგან ისინი ბუღალტრული ჩანაწერია.",
            "ანგარიშის წაშლა ან მონაცემების ასლის მოთხოვნა — მოგვწერე საკონტაქტო გვერდიდან.",
          ],
        },
        {
          heading: "რჩევა",
          body: [
            "რადგან ეს დემოა, გთხოვ, ნუ შეიყვან ნამდვილ პერსონალურ მონაცემებს — სატესტო მონაცემები სავსებით საკმარისია.",
          ],
        },
      ],
    },
    en: {
      title: "Privacy",
      intro: "What the application actually stores, where it goes, and for how long.",
      sections: [
        {
          heading: "What we store",
          body: [
            "Placing an order stores your name, phone, city, address, any note and — if you provide one — an email address.",
            "Creating an account stores your email, name, phone and a cryptographic hash of your password. The password itself is never stored.",
            "The cart and wishlist live only in your browser (localStorage) and are never sent to the server.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "bz_session — your sign-in session. Signed, httpOnly, 7 days. Without it you cannot stay signed in.",
            "bz_receipts — a signed list of orders placed from this browser, 30 days. It is what stops anyone else opening your order.",
            "cm_locale — your chosen language. bz_theme — your chosen theme. One year.",
            "There are no analytics or advertising cookies, which is why there is no consent banner.",
          ],
        },
        {
          heading: "Who else sees it",
          body: [
            "Vercel — hosting. Handles every request and keeps server logs (IP address, path, timestamp).",
            "Prisma Postgres — the database. Orders and accounts live here.",
            "Resend — email delivery. Receives the recipient address and the message body (a verification code, or order details).",
            "Google (Gemini) — the chat assistant on the site. Receives your message and whatever catalogue data is needed to answer it. If you ask about an order, it receives that order's status, items, total and city — not the name, phone number or street address.",
            "Important: the assistant runs on Google's free tier, where Google's terms state that conversations are used to improve its products. So: don't type real personal details into the chat.",
            "Nothing is shared with anyone else, and nothing is sold.",
          ],
        },
        {
          heading: "How long",
          body: [
            "One-time codes (verification, password reset) expire after 15 minutes.",
            "Orders are kept indefinitely, because they are accounting records.",
            "To delete an account or request a copy of your data, write to us from the contact page.",
          ],
        },
        {
          heading: "A note",
          body: [
            "Since this is a demo, please don't enter real personal details — sample data is entirely sufficient.",
          ],
        },
      ],
    },
  },
};

export function getInfoPage(slug: InfoSlug, locale: Locale) {
  return pages[slug][locale];
}
