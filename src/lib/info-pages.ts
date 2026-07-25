/**
 * Content for the static information pages linked from the footer.
 *
 * Kept as data rather than eight hand-written page components: every entry
 * renders through the same `InfoPageView`, so the pages stay consistent and
 * adding one is a matter of adding a key here plus a three-line route file.
 */
import type { Locale } from "@/lib/i18n";

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
        "ChinaMart არის ქართული პლატფორმა, რომელიც ჩინელი მწარმოებლების პროდუქციას პირდაპირ, შუამავლების გარეშე გაწვდის.",
      sections: [
        {
          heading: "როგორ ვმუშაობთ",
          body: [
            "ვირჩევთ პროდუქტს დადასტურებული ქარხნებიდან, ვამოწმებთ ნიმუშს და მხოლოდ ამის შემდეგ ვუკვეთავთ პარტიას.",
            "ტვირთი ჩამოდის საჰაერო და სახმელეთო გზით. საშუალო ვადა კარიდან კარამდე — 12-18 დღე.",
          ],
        },
        {
          heading: "რატომ არის ფასი დაბალი",
          body: [
            "ჩვენ არ ვიხდით დისტრიბუტორის და მაღაზიის მარჟას. ფასში შედის პროდუქტი, ტრანსპორტირება და განბაჟება — მეტი არაფერი.",
          ],
        },
      ],
    },
    en: {
      title: "About us",
      intro:
        "ChinaMart is a Georgian platform that brings products from Chinese manufacturers straight to you, with no middlemen.",
      sections: [
        {
          heading: "How we work",
          body: [
            "We pick products from verified factories, inspect a sample, and only then order a batch.",
            "Shipments travel by air and land. Average door-to-door time is 12-18 days.",
          ],
        },
        {
          heading: "Why the price is lower",
          body: [
            "We don't pay a distributor's or a retailer's margin. The price covers the product, transport and customs — nothing else.",
          ],
        },
      ],
    },
  },

  contact: {
    ka: {
      title: "კონტაქტი",
      intro: "დაგვიკავშირდი ნებისმიერ სამუშაო დღეს, 10:00-დან 19:00-მდე.",
      sections: [
        {
          heading: "საკონტაქტო ინფორმაცია",
          body: [
            "ტელეფონი: +995 032 2 00 00 00",
            "ელფოსტა: info@chinamart.ge",
            "მისამართი: თბილისი, ჭავჭავაძის გამზ. 45",
          ],
        },
        {
          heading: "შეკვეთის სტატუსი",
          body: [
            "შეკვეთის სტატუსის შესამოწმებლად მოგვწერე შეკვეთის ნომერი, რომელიც შეძენის შემდეგ მიიღე.",
          ],
        },
      ],
    },
    en: {
      title: "Contact",
      intro: "Reach us any working day between 10:00 and 19:00.",
      sections: [
        {
          heading: "Contact details",
          body: [
            "Phone: +995 032 2 00 00 00",
            "Email: info@chinamart.ge",
            "Address: 45 Chavchavadze Ave, Tbilisi",
          ],
        },
        {
          heading: "Order status",
          body: ["To check an order, send us the order number you received at checkout."],
        },
      ],
    },
  },

  faq: {
    ka: {
      title: "ხშირად დასმული კითხვები",
      intro: "ყველაზე ხშირი კითხვები შეკვეთაზე, მიწოდებასა და გარანტიაზე.",
      sections: [
        {
          heading: "რამდენ ხანში მივიღებ შეკვეთას?",
          body: ["საშუალოდ 12-18 სამუშაო დღე. ზუსტი ვადა თითოეულ პროდუქტზეა მითითებული."],
        },
        {
          heading: "როგორ ვიხდი?",
          body: ["გადახდა ხდება კურიერთან, პროდუქტის მიღებისას. ონლაინ გადახდა მალე დაემატება."],
        },
        {
          heading: "განბაჟება ცალკე მჭირდება?",
          body: ["არა. განბაჟება უკვე შედის ფასში — დამატებით არაფერს იხდი."],
        },
      ],
    },
    en: {
      title: "Frequently asked questions",
      intro: "The most common questions about ordering, delivery and warranty.",
      sections: [
        {
          heading: "How long does delivery take?",
          body: ["12-18 business days on average. The exact estimate is shown on each product."],
        },
        {
          heading: "How do I pay?",
          body: ["Cash on delivery, paid to the courier. Online payments are coming soon."],
        },
        {
          heading: "Do I have to handle customs myself?",
          body: ["No. Customs clearance is already included in the price."],
        },
      ],
    },
  },

  shipping: {
    ka: {
      title: "მიწოდება და განბაჟება",
      intro: "ვაგზავნით საქართველოს ყველა ქალაქში.",
      sections: [
        {
          heading: "ვადები",
          body: [
            "თბილისი — 12-16 დღე. რეგიონები — 14-18 დღე.",
            "ვადა აითვლება შეკვეთის დადასტურების დღიდან.",
          ],
        },
        {
          heading: "ღირებულება",
          body: [
            "მიწოდება უფასოა 200 ₾-ზე მეტ შეკვეთაზე. სხვა შემთხვევაში — 15 ₾.",
            "განბაჟება უკვე შედის პროდუქტის ფასში.",
          ],
        },
      ],
    },
    en: {
      title: "Shipping & customs",
      intro: "We deliver to every city in Georgia.",
      sections: [
        {
          heading: "Timelines",
          body: [
            "Tbilisi — 12-16 days. Regions — 14-18 days.",
            "The clock starts the day your order is confirmed.",
          ],
        },
        {
          heading: "Cost",
          body: [
            "Delivery is free on orders over ₾200, otherwise ₾15.",
            "Customs clearance is already included in the product price.",
          ],
        },
      ],
    },
  },

  returns: {
    ka: {
      title: "დაბრუნების პოლიტიკა",
      intro: "თუ პროდუქტი არ მოგერგო, დააბრუნე 14 დღის განმავლობაში.",
      sections: [
        {
          heading: "პირობები",
          body: [
            "პროდუქტი უნდა იყოს გამოუყენებელი, ორიგინალ შეფუთვაში, ყველა აქსესუართან ერთად.",
            "დაბრუნების მოთხოვნა უნდა დარეგისტრირდეს მიღებიდან 14 დღეში.",
          ],
        },
        {
          heading: "თანხის დაბრუნება",
          body: ["თანხას ვაბრუნებთ პროდუქტის მიღებიდან 5 სამუშაო დღეში."],
        },
      ],
    },
    en: {
      title: "Return policy",
      intro: "If a product isn't right for you, send it back within 14 days.",
      sections: [
        {
          heading: "Conditions",
          body: [
            "The product must be unused, in its original packaging, with all accessories.",
            "The return has to be registered within 14 days of delivery.",
          ],
        },
        {
          heading: "Refunds",
          body: ["We refund within 5 business days of receiving the returned product."],
        },
      ],
    },
  },

  warranty: {
    ka: {
      title: "გარანტია",
      intro: "ყველა პროდუქტს აქვს ადგილობრივი გარანტია.",
      sections: [
        {
          heading: "ვადა",
          body: [
            "ელექტრონიკა — 12 თვე. აქსესუარები — 6 თვე.",
            "გარანტიის ვადა აითვლება პროდუქტის მიღების დღიდან.",
          ],
        },
        {
          heading: "სერვისცენტრი",
          body: [
            "სერვისცენტრი მდებარეობს თბილისში — გარანტიისთვის ჩინეთში გაგზავნა არ გჭირდება.",
          ],
        },
      ],
    },
    en: {
      title: "Warranty",
      intro: "Every product carries a local warranty.",
      sections: [
        {
          heading: "Duration",
          body: [
            "Electronics — 12 months. Accessories — 6 months.",
            "The warranty starts the day you receive the product.",
          ],
        },
        {
          heading: "Service centre",
          body: ["Our service centre is in Tbilisi — nothing has to be shipped back to China."],
        },
      ],
    },
  },

  terms: {
    ka: {
      title: "წესები და პირობები",
      intro: "საიტით სარგებლობა ნიშნავს ამ პირობებზე თანხმობას.",
      sections: [
        {
          heading: "შეკვეთა",
          body: [
            "შეკვეთა ძალაში შედის ოპერატორის დადასტურების შემდეგ.",
            "ვიტოვებთ უფლებას გავაუქმოთ შეკვეთა, თუ პროდუქტი მარაგში აღარ არის.",
          ],
        },
        {
          heading: "ფასები",
          body: ["ფასები მითითებულია ლარში და მოიცავს მიწოდებასა და განბაჟებას."],
        },
      ],
    },
    en: {
      title: "Terms & conditions",
      intro: "Using this site means you accept these terms.",
      sections: [
        {
          heading: "Orders",
          body: [
            "An order becomes binding once our operator confirms it.",
            "We may cancel an order if the product is no longer in stock.",
          ],
        },
        {
          heading: "Prices",
          body: ["Prices are in Georgian lari and include delivery and customs."],
        },
      ],
    },
  },

  privacy: {
    ka: {
      title: "კონფიდენციალურობა",
      intro: "ვაგროვებთ მხოლოდ იმ მონაცემებს, რაც შეკვეთის შესასრულებლადაა საჭირო.",
      sections: [
        {
          heading: "რას ვაგროვებთ",
          body: ["სახელი, ტელეფონი, მისამართი და — სურვილის შემთხვევაში — ელფოსტა."],
        },
        {
          heading: "როგორ ვიყენებთ",
          body: [
            "მონაცემები გამოიყენება მხოლოდ შეკვეთის დამუშავებისა და მიწოდებისთვის.",
            "მესამე პირებს არ ვუზიარებთ, გარდა საკურიერო სამსახურისა.",
          ],
        },
      ],
    },
    en: {
      title: "Privacy",
      intro: "We collect only the data needed to fulfil your order.",
      sections: [
        {
          heading: "What we collect",
          body: ["Name, phone, address and — if you choose to give it — an email address."],
        },
        {
          heading: "How we use it",
          body: [
            "Your data is used only to process and deliver your order.",
            "We don't share it with third parties, apart from the courier service.",
          ],
        },
      ],
    },
  },
};

export function getInfoPage(slug: InfoSlug, locale: Locale) {
  return pages[slug][locale];
}
