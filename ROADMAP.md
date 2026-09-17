# Bazari — რა დარჩა

კოდი `main`-ზეა და Vercel-ზე ცოცხალია (`https://bazari-tornikepes-projects.vercel.app`).
გაკეთებულია და შემოწმებულია: Vercel-ის ცვლადები, Sentry (`peit` / `javascript-nextjs-ok`),
Google-ით შესვლა (Google Cloud `bazari-508917`), UptimeRobot `/api/health`-ზე, ტელეფონზე
შემოწმება. ბაზა 2026-09-17-ს განულდა — ბექაპი `backups/bazari-2026-09-17T00-10.json`
(`npm run db:restore`); Neon-ის „Restore from history" 6 საათს ფარავს. ყოველი მიგრაციის წინ
`npm run db:backup`.

Vercel-ის ცვლადი ასე იწერება: **Vercel → `bazari` → Settings → Environment Variables → Add**
(Production) → Save → **Deployments → ბოლო → ⋯ → Redeploy**.

---

## 1. ბიზნესის რეგისტრაცია — პირველი რეალური შეკვეთის წინ

*იურისტი/ბუღალტერი არ ვარ; ბუღალტერთან ერთი საათი ღირს, სანამ პირველ ლარს მიიღებ.*

- სანამ საიტი არაფერს ყიდის, ეს პორტფოლიო-პროექტია — რეგისტრაცია არ სჭირდება.
- ფულის მიღებამდე: **ინდ. მეწარმე** (იუსტიციის სახლი / my.gov.ge, ერთ დღეში, ~20–50 ₾) ან შპს.
  საგადასახადოში (rs.ge) ავტომატურად ხვდები.
- გადასახადი: **მცირე ბიზნესის სტატუსი** — ბრუნვის 1% (500 000 ₾-მდე), ყოველთვიური დეკლარაცია.
  დღგ მხოლოდ 12 თვეში 100 000 ₾-ის შემდეგ — Dashboard-ში დღგ 0-ზეა და სწორია.
- საიტზე სავალდებულო: გამყიდველის სახელი, საიდენტიფიკაციო კოდი, მისამართი, კონტაქტი,
  14-დღიანი დაბრუნება — ეს ყველაფერი Dashboard → პარამეტრებში იწერება (პ. 2).
- ბანკები და PayPal რეგისტრირებულ ბიზნესს ითხოვენ — ამიტომ პ. 5 ამის შემდეგაა.

## 2. რეკვიზიტები — რეგისტრაციის შემდეგ, Dashboard → პარამეტრები

მისამართი, ტელეფონი, ელფოსტა, სამუშაო საათები, tagline (footer-ში ჩანს), მიწოდების ზონები და
ფასები, დაბრუნების ვადა (14 დღე დგას). ინვოისზე, კონტაქტზე და footer-ში მხოლოდ შევსებული
ველები ჩნდება. საინფორმაციო გვერდები (ჩვენ შესახებ, კონტაქტი, წესები, კონფიდენციალურობა…)
ნამდვილი მაღაზიის ტექსტით არის დაწერილი — Dashboard → გვერდებში სწორდება. ინვოისი ფისკალური რომ გახდეს — ბუღალტერთან ნუმერაციის შეთანხმება, მერე ერთი
ველი ჩემი ნაწილია.

## 3. პროდუქტები — როცა გექნება, Dashboard → პროდუქტები

ფოტო (JPEG/PNG/WebP/AVIF, ბაზაში ინახება), აღწერა ორივე ენაზე, ფასი, თვითღირებულება (ანალიტიკის
მოგებისთვის), მარაგი. ახლა 40 სატესტო პროდუქტია placeholder-ით — ნამდვილების შემდეგ წაშალე.

## 4. დომენი — როცა იყიდი

1. Vercel → Settings → Domains → დაამატე; DNS-ში Vercel-ის ჩანაწერები.
2. Vercel-ის ცვლადი `NEXT_PUBLIC_SITE_URL` = `https://შენი-დომენი`.
3. Google Cloud (`bazari-508917`) → Clients → Bazari → redirect URI
   `https://შენი-დომენი/api/auth/google/callback`; Branding → Authorized domains.
4. UptimeRobot-ში მონიტორის URL.
5. **ელფოსტა (Resend)** — ამის გარეშე შეკვეთის დადასტურება, ვერიფიკაციის კოდი და პაროლის
   აღდგენა არ იგზავნება: [resend.com](https://resend.com) → Domains → Add → 3 DNS ჩანაწერი →
   Verify → API Keys → Create (`re_…`) → Vercel: `RESEND_API_KEY`, `MAIL_FROM` =
   `Bazari <noreply@შენი-დომენი>`. მერე README-ს „Notes and known limits" — ჩემი ნაწილია.

## 5. ონლაინ გადახდა — რეგისტრაციის შემდეგ, Dashboard → გადახდები

გასაღებები Dashboard → გადახდებში იწერება (არა Vercel-ზე); თითო პროვაიდერს თავისი ბარათი,
ტესტ-რეჟიმი და Callback მისამართი აქვს, რომელიც პროვაიდერის პორტალში უნდა ჩაწერო.

- **PayPal**: developer.paypal.com → Apps & Credentials → Create App → Client ID + Secret.
  ლარს არ იღებს — ვალუტა USD/EUR და კურსი ბარათშივე.
- **კრიპტო (Coinbase Commerce)**: commerce.coinbase.com → Settings → API keys; Webhook
  subscriptions → Callback მისამართი → shared secret.
- **TBC (TPAY)**: ხელშეკრულება tbcbank.ge-ზე (კვირები); developers.tbcbank.ge → Applications →
  API Key; ბანკიდან Client ID/Secret.
- **საქართველოს ბანკი (iPay)**: ხელშეკრულება bog.ge-ზე; ბიზნეს-ინტერნეტბანკი → iPay → API.

ადაპტერები ცოცხალ მერჩანტ-ანგარიშზე ჯერ არ გაშვებულა — პირველი ნამდვილი გადახდა თითოეულზე
ერთად ვნახოთ ტესტ-რეჟიმში; გასასწორებელი ერთ ფაილშია: `src/lib/payments/<პროვაიდერი>.ts`.

## 6. ბოლოს

- Facebook-ით შესვლა (სურვილისამებრ): developers.facebook.com → Create App → Facebook Login →
  Valid OAuth Redirect URI `https://დომენი/api/auth/facebook/callback` → App ID/Secret → Vercel
  `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` → App Mode: Live.
- README-ს სქრინშოტები — პროდუქტების ფოტოების შემდეგ.
- ყოველდღიური ავტომატური ბექაპი — თუ დაგჭირდება, ერთი cron-ია.

---

**რიგი:** 1 → 2 → 3 → 4 → 5 → 6. ახლა არაფერია, რაც ჩემ მხარესაა — ყოველი პუნქტი შენს
ნაბიჯს ელოდება (რეგისტრაცია, პროდუქტი, დომენი). რაც გაკეთდება, აქედან წაიშლება.
