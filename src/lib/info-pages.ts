/**
 * Content for the static information pages linked from the footer.
 *
 * Kept as data rather than eight hand-written page components: every entry
 * renders through the same `InfoPageView`, so the pages stay consistent and
 * adding one is a matter of adding a key here plus a three-line route file.
 *
 * The copy describes only what the application actually does — the rules
 * mentioned here (delivery cost, the return window, what the assistant is
 * told) are the ones the code enforces. Phone numbers, addresses and hours
 * are not written in: the contact page reads them from settings, so the
 * text never states a number the shop has stopped answering.
 */
import type { Locale } from "@/lib/i18n";

type Section = { heading: string; body: string[] };
type Content = { title: string; intro: string; sections: Section[] };

export const INFO_SLUGS = [
  "about",
  "contact",
  "faq",
  "shipping",
  "returns",
  "warranty",
  "terms",
  "privacy",
] as const;

export type InfoSlug = (typeof INFO_SLUGS)[number];

/**
 * The prose that ships with the repository.
 *
 * Static again. Two paragraphs quote the delivery rules, and they do it with
 * `{freeShipping}` / `{shippingFee}` placeholders rather than numbers — those
 * resolve from settings wherever the page is rendered, so a sentence here can
 * never state a rule the checkout no longer applies. That is not hypothetical:
 * this page once advertised free delivery over ₾20,000 against a real rule of
 * ₾200, because the figure had been typed in.
 *
 * Once seeded, the database holds the editable copy of all of this and these
 * values become the fallback for an unseeded install.
 */
const pages: Record<InfoSlug, Record<Locale, Content>> = {
  about: {
    ka: {
      title: "ჩვენ შესახებ",
      intro:
        "{shopName} — ონლაინ მაღაზია ტექნიკის, აქსესუარებისა და საყოფაცხოვრებო ნივთებისთვის, მიწოდებით მთელ საქართველოში.",
      sections: [
        {
          heading: "რას ვყიდით",
          body: [
            "ელექტრონიკა, ტელეფონის აქსესუარები, აუდიო, სახლისა და სამზარეულოს ნივთები, ხელსაწყოები, სილამაზისა და მოვლის საშუალებები, სპორტი და ავტო-აქსესუარები — ყველაფერი ერთ კატალოგში, ფილტრებითა და ძებნით.",
            "ფასი, მარაგი და მიწოდების ვადა თითოეულ პროდუქტზე ზუსტად ის არის, რაც ამ წუთას გვაქვს: კატალოგი პირდაპირ საწყობის ჩანაწერებიდან იკითხება.",
          ],
        },
        {
          heading: "როგორ მუშაობს",
          body: [
            "აირჩიე პროდუქტი, ჩადე კალათაში და გააფორმე შეკვეთა — გადახდა კურიერთან, ბარათით ან გადარიცხვით. შეკვეთის სტატუსს ანგარიშიდან ან „შეკვეთის მოძებნის“ გვერდიდან ადევნებ თვალს.",
            "მიწოდებიდან {returnWindow} დღის განმავლობაში შეკვეთის დაბრუნება შეგიძლია — დეტალები დაბრუნების პოლიტიკაშია.",
          ],
        },
      ],
    },
    en: {
      title: "About us",
      intro:
        "{shopName} is an online store for electronics, accessories and household goods, delivering across Georgia.",
      sections: [
        {
          heading: "What we sell",
          body: [
            "Electronics, phone accessories, audio, home and kitchen, tools, beauty and care, sport and car accessories — all in one catalogue, with filters and search.",
            "The price, stock and delivery estimate on each product are exactly what we have right now: the catalogue is read straight from the warehouse records.",
          ],
        },
        {
          heading: "How it works",
          body: [
            "Pick a product, add it to the cart and place the order — pay the courier, by card or by bank transfer. Follow the order from your account or from the “Track your order” page.",
            "An order can be returned within {returnWindow} days of delivery — the details are in the return policy.",
          ],
        },
      ],
    },
  },

  contact: {
    ka: {
      title: "კონტაქტი",
      intro: "შეკითხვა შეკვეთაზე, პროდუქტზე თუ მიწოდებაზე — მოგვწერე ან დაგვირეკე, ვპასუხობთ სამუშაო საათებში.",
      sections: [
        {
          heading: "შეკვეთის სტატუსი",
          body: [
            "შეკვეთის სტატუსი ანგარიშში, „ჩემი შეკვეთების“ გვერდზე ჩანს. ანგარიშის გარეშე გამოიყენე „შეკვეთის მოძებნა“ — დაგჭირდება შეკვეთის ნომერი და ტელეფონი, რომელიც შეკვეთისას მიუთითე.",
            "შეკვეთის მიღებისა და გზაში გასვლის შესახებ ელფოსტაზეც გატყობინებთ.",
          ],
        },
        {
          heading: "დაბრუნება და პრობლემა პროდუქტთან",
          body: [
            "დაზიანებული ან არასწორი პროდუქტი მოვიდა? გახსენი შეკვეთა ანგარიშში და გააგზავნე დაბრუნების მოთხოვნა — ჩვენი პასუხი იმავე გვერდზე გამოჩნდება.",
          ],
        },
      ],
    },
    en: {
      title: "Contact",
      intro: "A question about an order, a product or delivery — write or call, and we answer during working hours.",
      sections: [
        {
          heading: "Order status",
          body: [
            "The status of an order is on the “My orders” page of your account. Without an account, use “Track your order” — you'll need the order number and the phone number you entered at checkout.",
            "We also email you when the order is received and when it is on its way.",
          ],
        },
        {
          heading: "Returns and problems with a product",
          body: [
            "Received a damaged or wrong item? Open the order in your account and send a return request — our answer appears on the same page.",
          ],
        },
      ],
    },
  },

  faq: {
    ka: {
      title: "ხშირად დასმული კითხვები",
      intro: "კითხვები შეკვეთაზე, გადახდაზე, მიწოდებასა და დაბრუნებაზე.",
      sections: [
        {
          heading: "რეგისტრაცია მჭირდება?",
          body: [
            "დიახ — შეკვეთის გასაფორმებლად ანგარიშია საჭირო. ეს ერთი წუთია: სახელი, ელფოსტა, ტელეფონი და პაროლი, ან Google-ით შესვლა. ანგარიშში ყველა შეკვეთა, სტატუსი და მისამართი ერთად ინახება.",
          ],
        },
        {
          heading: "როგორ გადავიხადო?",
          body: [
            "კურიერთან ნაღდი ფულით ან ბარათით, საბანკო გადარიცხვით (ინვოისი შეკვეთის გვერდიდან იტვირთება), ან ონლაინ — რომელი გადახდის მეთოდია ჩართული, შეკვეთის გაფორმებისას ჩანს.",
          ],
        },
        {
          heading: "რა ღირს მიწოდება?",
          body: [
            "მიწოდება უფასოა {freeShipping}-ზე მეტ შეკვეთაზე, სხვა შემთხვევაში — {shippingFee}. ზუსტი თანხა კალათაშივე ჩანს.",
          ],
        },
        {
          heading: "როგორ ვნახო ჩემი შეკვეთა?",
          body: [
            "ანგარიშში, „ჩემი შეკვეთების“ გვერდზე. ან გვერდზე „შეკვეთის მოძებნა“ შეიყვანე შეკვეთის ნომერი და ტელეფონი — ტელეფონი იმისთვისაა, რომ სხვისი შეკვეთა ვერავინ ნახოს.",
          ],
        },
        {
          heading: "შემიძლია დაბრუნება?",
          body: [
            "დიახ, მიწოდებიდან {returnWindow} დღის განმავლობაში — მოთხოვნა შეკვეთის გვერდიდანვე იგზავნება. დეტალები დაბრუნების პოლიტიკაშია.",
          ],
        },
      ],
    },
    en: {
      title: "Frequently asked questions",
      intro: "Questions about ordering, payment, delivery and returns.",
      sections: [
        {
          heading: "Do I need an account?",
          body: [
            "Yes — an account is required to place an order. It takes a minute: name, email, phone and a password, or sign in with Google. The account keeps every order, its status and your addresses in one place.",
          ],
        },
        {
          heading: "How do I pay?",
          body: [
            "Cash or card to the courier, by bank transfer (the invoice downloads from the order page), or online — the payment methods that are switched on are shown at checkout.",
          ],
        },
        {
          heading: "What does delivery cost?",
          body: [
            "Delivery is free on orders over {freeShipping}, otherwise {shippingFee}. The exact amount is shown in the cart.",
          ],
        },
        {
          heading: "How do I find my order?",
          body: [
            "In your account, on the “My orders” page. Or on the “Track your order” page, enter the order number and your phone — the phone is there so that nobody else can look up your order.",
          ],
        },
        {
          heading: "Can I return an item?",
          body: [
            "Yes, within {returnWindow} days of delivery — the request is made from the order page itself. The details are in the return policy.",
          ],
        },
      ],
    },
  },

  shipping: {
    ka: {
      title: "მიწოდება",
      intro: "მიწოდების წესები, რომლებსაც კალათა და შეკვეთის გაფორმება ნამდვილად იყენებს.",
      sections: [
        {
          heading: "ღირებულება",
          body: [
            "მიწოდება უფასოა {freeShipping}-ზე მეტ შეკვეთაზე. სხვა შემთხვევაში — {shippingFee}. ზოგიერთ ქალაქსა და რეგიონს თავისი ტარიფი აქვს — ის შეკვეთის გაფორმებისას, ქალაქის არჩევისთანავე ჩანს.",
            "თანხა კალათაშივე ჩანს და შეკვეთის ჯამში სერვერზე ითვლება — რასაც კალათაში ხედავ, იმას იხდი.",
          ],
        },
        {
          heading: "ვადები",
          body: [
            "მიწოდების სავარაუდო ვადა თითოეულ პროდუქტზეა მითითებული. თუ შეკვეთაში რამდენიმე პროდუქტია, ვადა ყველაზე გრძელს ეყრდნობა.",
            "შეკვეთის მიღებისა და გზაში გასვლის შესახებ ელფოსტაზე გატყობინებთ; მიმდინარე სტატუსი შეკვეთის გვერდზე ჩანს.",
          ],
        },
      ],
    },
    en: {
      title: "Shipping",
      intro: "The delivery rules the cart and checkout actually apply.",
      sections: [
        {
          heading: "Cost",
          body: [
            "Delivery is free on orders over {freeShipping}, otherwise {shippingFee}. Some cities and regions have their own rate — it is shown at checkout as soon as you choose the city.",
            "The amount is shown in the cart and recalculated on the server when the order is placed — what you see in the cart is what you pay.",
          ],
        },
        {
          heading: "Timelines",
          body: [
            "The delivery estimate is stated on each product. For an order with several products, the estimate follows the longest one.",
            "We email you when the order is received and when it is on its way; the current status is on the order page.",
          ],
        },
      ],
    },
  },

  returns: {
    ka: {
      title: "დაბრუნების პოლიტიკა",
      intro: "მიწოდებიდან {returnWindow} დღის განმავლობაში შეკვეთის დაბრუნება შეგიძლია — მოთხოვნა შეკვეთის გვერდიდანვე იგზავნება.",
      sections: [
        {
          heading: "როგორ მოვითხოვო",
          body: [
            "გახსენი შეკვეთა ანგარიშში, აირჩიე, რომელი პროდუქტების დაბრუნება გინდა და რატომ (დაზიანებულია, არასწორი მოვიდა, აღწერას არ შეესაბამება, სხვა), და გააგზავნე მოთხოვნა. ჩვენი პასუხი იმავე გვერდზე გამოჩნდება და ელფოსტაზეც მოგდის.",
            "მოთხოვნა შესაძლებელია მხოლოდ მიწოდებული შეკვეთისთვის, მიღებიდან {returnWindow} დღის განმავლობაში.",
          ],
        },
        {
          heading: "რა ხდება შემდეგ",
          body: [
            "დამტკიცების შემდეგ პროდუქტი გამოგზავნე ან მოიტანე — სად და როგორ, პასუხშივე იქნება. პროდუქტი სრულ კომპლექტში და შეძლებისდაგვარად თავდაპირველ შეფუთვაში უნდა დაბრუნდეს.",
            "როცა პროდუქტს მივიღებთ, თანხა იმავე გზით ბრუნდება, რითაც გადაიხადე: კურიერთან გადახდილი — საბანკო ანგარიშზე, რომელსაც ანგარიშის პარამეტრებში მიუთითებ; ბარათით გადახდილი — იმავე ბარათზე.",
          ],
        },
      ],
    },
    en: {
      title: "Return policy",
      intro: "An order can be returned within {returnWindow} days of delivery — the request is made from the order page itself.",
      sections: [
        {
          heading: "How to ask",
          body: [
            "Open the order in your account, choose which items you are sending back and why (damaged, wrong item, not as described, other), and send the request. Our answer appears on the same page and is also emailed to you.",
            "A request is only possible for a delivered order, within {returnWindow} days of receiving it.",
          ],
        },
        {
          heading: "What happens next",
          body: [
            "Once approved, send the item back or bring it in — where and how is in the answer. The item must come back complete and, where possible, in its original packaging.",
            "When we have received it, the money goes back the way it was paid: paid to the courier — to the bank account you set in your account settings; paid by card — to the same card.",
          ],
        },
      ],
    },
  },

  warranty: {
    ka: {
      title: "გარანტია",
      intro: "ყველა პროდუქტს მოქმედი კანონმდებლობით დადგენილი გარანტია აქვს; მწარმოებლის გარანტია, სადაც არის, პროდუქტის გვერდზეა მითითებული.",
      sections: [
        {
          heading: "რას ფარავს",
          body: [
            "ქარხნულ დეფექტს და გაუმართაობას, რომელიც ჩვეულებრივი გამოყენებისას გამოვლინდა. არ ფარავს მექანიკურ დაზიანებას, სითხის მოხვედრას, არასწორ გამოყენებას და ბუნებრივ ცვეთას.",
          ],
        },
        {
          heading: "როგორ ვისარგებლო",
          body: [
            "გახსენი შეკვეთა ანგარიშში და გააგზავნე მოთხოვნა მიზეზით „დაზიანებულია“ ან „აღწერას არ შეესაბამება“, ან დაგვიკავშირდი საკონტაქტო გვერდიდან — შეკვეთის ნომერი და პრობლემის მოკლე აღწერა საკმარისია.",
            "დეფექტის დადასტურების შემდეგ პროდუქტი შეიცვლება, შეკეთდება ან თანხა დაბრუნდება — რაც უფრო სწრაფად შეიძლება.",
          ],
        },
      ],
    },
    en: {
      title: "Warranty",
      intro: "Every product carries the warranty set by law; a manufacturer's warranty, where there is one, is stated on the product page.",
      sections: [
        {
          heading: "What it covers",
          body: [
            "Factory defects and faults that appear in normal use. It does not cover mechanical damage, liquid damage, misuse or ordinary wear.",
          ],
        },
        {
          heading: "How to claim",
          body: [
            "Open the order in your account and send a request with the reason “damaged” or “not as described”, or reach us from the contact page — the order number and a short description of the problem are enough.",
            "Once the defect is confirmed, the product is replaced, repaired or refunded — whichever can be done fastest.",
          ],
        },
      ],
    },
  },

  terms: {
    ka: {
      title: "წესები და პირობები",
      intro: "რას ნიშნავს შეკვეთის გაფორმება {shopName}-ზე — მოკლედ და გასაგებად.",
      sections: [
        {
          heading: "შეკვეთა",
          body: [
            "შეკვეთის გაფორმებით თანხმდები ამ პირობებს. შეკვეთა ძალაში შედის, როცა მას ვადასტურებთ. გაუქმება გინდა? დაგვიკავშირდი საკონტაქტო გვერდიდან, სანამ შეკვეთა გზაში გავა.",
            "თუ პროდუქტი დადასტურების შემდეგ მარაგში აღარ აღმოჩნდა, დაგიკავშირდებით და შეგთავაზებთ შემცვლელს ან სრულ თანხის დაბრუნებას.",
          ],
        },
        {
          heading: "ფასები და გადახდა",
          body: [
            "ფასები მითითებულია ლარში და მოიცავს ყველა გადასახადს. მიწოდების ღირებულება ცალკეა და კალათაშივე ჩანს. ფასი, რომელიც შეკვეთის გაფორმებისას იყო, შეკვეთაზე ფიქსირდება.",
            "გადახდა — კურიერთან, საბანკო გადარიცხვით ან ონლაინ, შეკვეთის გაფორმებისას არჩეული მეთოდით.",
          ],
        },
        {
          heading: "დაბრუნება და გარანტია",
          body: [
            "დაბრუნების წესები დაბრუნების პოლიტიკაშია, გარანტიისა — გარანტიის გვერდზე. ორივე ამ პირობების ნაწილია.",
          ],
        },
        {
          heading: "ანგარიში",
          body: [
            "ანგარიშზე პასუხისმგებელი ხარ შენ — პაროლი არავის გაუზიარო. ანგარიშის წაშლა ნებისმიერ დროს შეგიძლია მოითხოვო საკონტაქტო გვერდიდან.",
          ],
        },
      ],
    },
    en: {
      title: "Terms & conditions",
      intro: "What placing an order on {shopName} means — short and plain.",
      sections: [
        {
          heading: "Orders",
          body: [
            "By placing an order you agree to these terms. An order takes effect when we confirm it. Want to cancel? Reach us from the contact page before the order is on its way.",
            "If a product turns out to be out of stock after confirmation, we contact you and offer a replacement or a full refund.",
          ],
        },
        {
          heading: "Prices and payment",
          body: [
            "Prices are in Georgian lari and include all taxes. Delivery is charged separately and shown in the cart. The price at the time of ordering is the price of the order.",
            "Payment is to the courier, by bank transfer or online, by the method chosen at checkout.",
          ],
        },
        {
          heading: "Returns and warranty",
          body: [
            "The return rules are in the return policy and the warranty rules on the warranty page. Both are part of these terms.",
          ],
        },
        {
          heading: "Your account",
          body: [
            "You are responsible for your account — do not share the password. You can ask for the account to be deleted at any time from the contact page.",
          ],
        },
      ],
    },
  },

  privacy: {
    ka: {
      title: "კონფიდენციალურობა",
      intro: "რა მონაცემებს ვინახავთ, სად მიდის და რამდენ ხანს.",
      sections: [
        {
          heading: "რას ვინახავთ",
          body: [
            "ანგარიშის შექმნისას: სახელი, ელფოსტა, ტელეფონი და პაროლის კრიპტოგრაფიული ჰეში — პაროლი ღია ტექსტად არასდროს ინახება. Google-ით შესვლისას Google-ისგან მხოლოდ სახელს და ელფოსტას ვიღებთ.",
            "შეკვეთის გაფორმებისას: მიმღების სახელი, ტელეფონი, ქალაქი, მისამართი და კომენტარი. შენახული მისამართები, გადახდის სასურველი მეთოდი და დაბრუნებისთვის მითითებული საბანკო რეკვიზიტები ანგარიშშია.",
            "ბარათის ნომერს არასდროს ვხედავთ და არ ვინახავთ — ონლაინ გადახდა პროვაიდერის გვერდზე ხდება.",
            "კალათა და რჩეულები შენს ბრაუზერშია. შესული მომხმარებლის რჩეულები და კალათის შიგთავსი სერვერზეც ინახება, რომ სხვა მოწყობილობიდანაც ჩანდეს და მიტოვებულ კალათაზე ერთხელ შეგახსენოთ.",
            "შეფასების ფოტოები და პროფილის ფოტო ჩვენს ბაზაში ინახება.",
          ],
        },
        {
          heading: "Cookie-ები",
          body: [
            "bz_session — შესვლის სესია, ხელმოწერილი, httpOnly, 7 დღე. bz_receipts — ამ ბრაუზერიდან გაფორმებული შეკვეთების ხელმოწერილი სია, 30 დღე, რომ შენს შეკვეთას მხოლოდ შენ ხედავდე. cm_locale და bz_theme — არჩეული ენა და თემა, ერთი წელი. bz_chat — ჩატ-ასისტენტის ანონიმური სესია, 30 დღე. Google-ით შესვლისას რამდენიმე წუთით ერთჯერადი cookie იდება (bz_oauth_*).",
            "ანალიტიკის ან რეკლამის cookie არ გვაქვს, ამიტომ თანხმობის ფანჯარაც არ არის საჭირო. გვერდისა და პროდუქტის ნახვებს ვითვლით — რომელი გვერდი რამდენჯერ გაიხსნა დღეში — მაგრამ არც ვინაობას, არც IP მისამართს არ ვინახავთ: ერთი დღის ვიზიტორები ერთმანეთისგან იმ დღის გასაღებით განსხვავდება, რომელიც შუაღამისას იცვლება და ვერავის უკან ვერ მიაბრუნებ.",
          ],
        },
        {
          heading: "ვის გადაეცემა",
          body: [
            "Vercel — ჰოსტინგი; ამუშავებს მოთხოვნებს და ინახავს სერვერის ლოგებს (IP მისამართი, გვერდი, დრო). Neon — ბაზა, სადაც შეკვეთები და ანგარიშები ინახება.",
            "Resend — ელფოსტის გაგზავნა; იღებს მიმღების მისამართს და წერილის შიგთავსს (დადასტურების კოდი, შეკვეთის დეტალები). Sentry — შეცდომების აღრიცხვა; იღებს შეცდომის ტექსტს, არასდროს — cookie-ს ან ფორმის შიგთავსს.",
            "Google — შესვლა Google-ით, თუ ამას აირჩევ. გადახდის პროვაიდერი (ბანკი, PayPal ან კრიპტო-სერვისი) — მხოლოდ ონლაინ გადახდისას, შეკვეთის თანხა და ნომერი.",
            "ჩატ-ასისტენტი, თუ ჩართულია, ენობრივი მოდელის პროვაიდერს (Google ან Anthropic) გადასცემს შენს შეტყობინებას და პასუხისთვის საჭირო კატალოგის მონაცემებს. შეკვეთის სტატუსის კითხვისას — სტატუსს, ნივთებს, თანხას და ქალაქს; სახელს, ტელეფონს და მისამართს არა. ჩატში პერსონალურ მონაცემებს ნუ დაწერ.",
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
      ],
    },
    en: {
      title: "Privacy",
      intro: "What we store, where it goes, and for how long.",
      sections: [
        {
          heading: "What we store",
          body: [
            "Creating an account stores your name, email, phone and a cryptographic hash of your password — the password itself is never stored. Signing in with Google gives us only your name and email from Google.",
            "Placing an order stores the recipient's name, phone, city, address and any note. Saved addresses, your preferred payment method and the bank details you give for refunds live in your account.",
            "We never see or store a card number — online payment happens on the provider's page.",
            "The cart and wishlist live in your browser. For a signed-in customer the wishlist and cart contents are also kept on the server, so they show on another device and so we can remind you once about a cart you left behind.",
            "Review photos and your profile picture are stored in our database.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "bz_session — your sign-in session, signed, httpOnly, 7 days. bz_receipts — a signed list of orders placed from this browser, 30 days, so that only you can open your order. cm_locale and bz_theme — your chosen language and theme, one year. bz_chat — an anonymous session for the chat assistant, 30 days. Signing in with Google sets one-time cookies (bz_oauth_*) for a few minutes.",
            "There are no analytics or advertising cookies, which is why there is no consent banner. Page and product views are counted — which page, how many times, on which day — but nothing about who, and no IP address is kept: a day's visitors are told apart by a key that changes at midnight and cannot be turned back into anybody.",
          ],
        },
        {
          heading: "Who else sees it",
          body: [
            "Vercel — hosting; handles requests and keeps server logs (IP address, path, timestamp). Neon — the database where orders and accounts live.",
            "Resend — email delivery; receives the recipient address and the message (a verification code, order details). Sentry — error tracking; receives the error text, never a cookie or a form's contents.",
            "Google — sign-in with Google, if you choose it. A payment provider (a bank, PayPal or a crypto service) — only when paying online, the order amount and number.",
            "The chat assistant, when it is on, sends your message and the catalogue data needed to answer it to the language-model provider (Google or Anthropic). When you ask about an order it receives the status, items, total and city — not the name, phone or street address. Don't type personal details into the chat.",
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
      ],
    },
  },
};

export function getInfoPage(slug: InfoSlug, locale: Locale) {
  return pages[slug][locale];
}
