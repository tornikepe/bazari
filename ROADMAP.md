# Bazari — რა დარჩა გასაკეთებელი

აქ მხოლოდ ისაა, რაც ჯერ არ არის გაკეთებული. რაც გაკეთდა და რატომ — კომიტების ისტორიაშია და
README-ში, აქ არ მეორდება.

**მდგომარეობა 2026-09-15:** კოდი `main`-ზეა და Vercel-ზე ცოცხალია. production ბაზას ყველა
მიგრაცია (40) აქვს, ბექაპი აღებულია (`backups/bazari-2026-09-15T12-22.json`). ტესტები
წაშლილია გადაწყვეტილებით — მათზე მეტი დრო იხარჯებოდა, ვიდრე სარგებელი მოჰქონდა. ყოველ push-ზე
CI ორ რამეს ამოწმებს, ორივე რამდენიმე წუთია: კოდი (lint და ტიპები) და ბაზა (ყველა მიგრაცია
ცარიელ Postgres-ზე, მერე seed და შემოწმება). თუ რომელიმე გაწითლდა — მითხარი.

ცოცხალ საიტზე 2026-09-15-ს შევამოწმე: `AUTH_SECRET` ძველი placeholder **არ არის** (ყალბი
ქუქი უარყოფილია), `NEXT_PUBLIC_SITE_URL` დაყენებულია (`https://bazari-tornikepes-projects.vercel.app`).

---

## 1. ახლავე, 10 წუთში — Vercel-ის პარამეტრებში

Vercel → პროექტი `bazari` → Settings → Environment Variables. ცვლილების შემდეგ **Redeploy**.

| ცვლადი | რა ჩაწერო | რა ხდება უიმისოდ |
|---|---|---|
| `CRON_SECRET` | ნებისმიერი გრძელი შემთხვევითი სტრიქონი (`openssl rand -base64 32`). **ახლა არ დგას** — `/api/cron/daily` 503-ს აბრუნებს | ყოველდღიური სამუშაო არ ეშვება: მიტოვებული კალათის შეხსენება არ იგზავნება, გადაუხდელი მცდელობები არ იხურება |
| `PAYMENT_SANDBOX` | **არ უნდა იყოს** სიაში — გარედან ვერ ვამოწმებ, სიაში ნახე | თუ `1` დგას, ბარათით შეკვეთა ფულის გარეშე „გადახდილად" ინიშნება |

---

## 2. ანგარიშები და გასაღებები

ყველა გასაღები ერთ ადგილას იწერება: **Vercel → პროექტი `bazari` → Settings → Environment
Variables → Add** (Key / Value, Environment: Production) → **Save**. ბოლოს **Deployments →
ბოლო deploy → ⋯ → Redeploy**, თორემ ახალი ცვლადი არ ამოქმედდება.

### A3 — Resend (ელფოსტა) — პირველ რიგში

რას აძლევს: შეკვეთის დადასტურება PDF ინვოისით, გაგზავნის შეტყობინება, დაბრუნების პასუხი,
მიტოვებული კალათა, „პროდუქტი დაბრუნდა", ვერიფიკაციის კოდი. ახლა ეს წერილები ლოგში იწერება.

1. [resend.com](https://resend.com) → **Sign up** (GitHub-ით ან ელფოსტით).
2. მარცხენა მენიუ **Domains → Add Domain** → ჩაწერე შენი დომენი (მაგ. `bazari.ge`) → **Add**.
   გამოჩნდება 3 DNS ჩანაწერი (TXT და MX). გახსენი შენი დომენის რეგისტრატორის DNS გვერდი
   და ზუსტად ისე დაამატე თითოეული (Name და Value სვეტები) → Resend-ზე **Verify DNS
   Records**. სტატუსი „Verified" წუთებიდან რამდენიმე საათამდე გახდება.
3. **API Keys → Create API Key** → სახელი `bazari`, Permission: **Full access** → **Add** →
   დააკოპირე გასაღები (`re_…`) — **მხოლოდ ერთხელ ჩანს**.
4. Vercel-ზე ორი ცვლადი:
   - `RESEND_API_KEY` = `re_…`
   - `MAIL_FROM` = `Bazari <noreply@bazari.ge>` (დომენი — ის, რაც მე-2 ნაბიჯში დაადასტურე)

### A8 — Sentry (შეცდომების თვალყური)

1. [sentry.io](https://sentry.io) → **Sign up** → **Create Project** → პლატფორმა **Next.js** →
   Project name `bazari` → **Create Project**.
2. **Settings → Projects → bazari → Client Keys (DSN)** → დააკოპირე **DSN**
   (`https://…@…ingest.sentry.io/…`).
3. Vercel-ზე: `NEXT_PUBLIC_SENTRY_DSN` = DSN.
4. სურვილისამებრ — რომ შეცდომა ფაილის ხაზზე მიუთითებდეს და არა minified კოდზე:
   - **Settings → Auth Tokens → Create New Token** → Scopes: `project:releases`, `org:read`
     → **Create** → დააკოპირე → Vercel: `SENTRY_AUTH_TOKEN`.
   - `SENTRY_ORG` = ორგანიზაციის slug (ბრაუზერის მისამართიდან:
     `sentry.io/organizations/`**`ეს-ნაწილი`**`/`).
   - `SENTRY_PROJECT` = `bazari`.

### A1 — Google-ით შესვლა

1. [console.cloud.google.com](https://console.cloud.google.com) → ზედა ზოლში პროექტი →
   **New Project** → სახელი `Bazari` → **Create** → აირჩიე.
2. **APIs & Services → OAuth consent screen** → **External** → App name `Bazari`, User support
   email და Developer contact email — შენი → **Save and Continue** ბოლომდე → **Publish App**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** →
   Application type **Web application** → Name `Bazari` → **Authorized redirect URIs → Add URI**
   — ორივე, სიმბოლო-სიმბოლო:
   - `https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
   (როცა დომენი გექნება — `https://შენი-დომენი/api/auth/google/callback`-იც)
   → **Create**.
4. ფანჯარაში გამოჩნდება **Client ID** (`…apps.googleusercontent.com`) და **Client secret** →
   Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. ღილაკი საიტზე მაშინვე გამოჩნდება.

### A1 — Facebook-ით შესვლა (სურვილისამებრ)

1. [developers.facebook.com](https://developers.facebook.com) → **My Apps → Create App** →
   Use case **Authenticate and request data from users with Facebook Login** → სახელი
   `Bazari` → **Create App**.
2. **Use cases → Facebook Login → Customize → Settings** → **Valid OAuth Redirect URIs**:
   `https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/facebook/callback` →
   **Save changes**. იმავე გვერდზე დარწმუნდი, რომ `email` permission დამატებულია.
3. **App settings → Basic** → **App ID** და **App secret** (Show) → Vercel:
   `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.
4. ზედა ზოლში **App Mode: Development → Live**, თორემ მხოლოდ შენ შეძლებ შესვლას.

### A4 — ონლაინ გადახდა: TBC, საქართველოს ბანკი, PayPal, კრიპტო

კოდი მზადაა ოთხივესთვის. გასაღებები **Dashboard → გადახდები**-ში იწერება (არა Vercel-ზე):
თითო პროვაიდერს თავისი ბარათი აქვს — ჩართვა, ტესტ-რეჟიმი, ველები და Callback მისამართი,
რომელიც პროვაიდერის პორტალში უნდა ჩაწერო. ჩართული და შევსებული მეთოდი მაშინვე ჩნდება
გაფორმებაზე; მყიდველი პროვაიდერის გვერდზე იხდის, ბრუნდება, და შეკვეთა ავტომატურად ხდება
„გადახდილი“ და „დადასტურებული“.

**TBC ბანკი (TPAY)**
1. ხელშეკრულება: tbcbank.ge → ბიზნესი → „ონლაინ გადახდები (TPAY)“ — განაცხადი, კვირები.
2. [developers.tbcbank.ge](https://developers.tbcbank.ge) → ანგარიში → **Applications → Create**
   → აპლიკაციის **API Key** დააკოპირე.
3. ბანკი ხელშეკრულების შემდეგ გამოგიგზავნის **Client ID** და **Client Secret**-ს.
4. Dashboard → გადახდები → TBC: სამივე ჩაწერე, Callback მისამართი TPAY-ის მერჩანტ-კაბინეტში
   ჩააგდე, „ტესტ-რეჟიმი“ მოხსენი როცა ნამდვილი გასაღებებია → ჩართე → შენახვა.

**საქართველოს ბანკი (iPay)**
1. ხელშეკრულება: bog.ge → ბიზნესი → „iPay ონლაინ გადახდები“.
2. ბიზნეს-ინტერნეტბანკი → **iPay → API** → **Client ID** და **Client Secret**.
3. Dashboard → გადახდები → Bank of Georgia: ორივე ჩაწერე, Callback მისამართი iPay-ის
   პარამეტრებში → ჩართე → შენახვა.

**PayPal**
1. [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** → **Create App**
   → **Client ID** და **Secret** (Sandbox და Live ცალ-ცალკეა — რომელსაც იწერ, იმ რეჟიმში იყავი).
2. PayPal ლარს არ იღებს: ველში „ვალუტა“ USD ან EUR, „კურსი“ — რამდენი ლარია 1 ერთეული
   (მაგ. 2.70). ლარის ჯამი ამ კურსით გადაიყვანება და კურსი შენი შესაცვლელია.
3. სურვილისამებრ: აპლიკაცია → **Webhooks → Add** → Callback მისამართი, events: *Payment
   capture completed / denied / refunded* → **Webhook ID** ჩაწერე. მის გარეშეც მუშაობს — გადახდა
   საიტზე დაბრუნებისას დასტურდება.

**კრიპტოვალუტა (Coinbase Commerce)**
1. [commerce.coinbase.com](https://commerce.coinbase.com) → ანგარიში → **Settings → API keys →
   Create** → API Key.
2. **Settings → Webhook subscriptions → Add endpoint** → Callback მისამართი → **Show shared
   secret** → ჩაწერე.
3. ვალუტა (USD/EUR) და კურსი — PayPal-ის მსგავსად. მყიდველი ნებისმიერი კრიპტოვალუტით იხდის;
   დაბრუნება ხელით ხდება.

ადაპტერები პროვაიდერების საჯარო დოკუმენტაციით არის დაწერილი და ცოცხალ მერჩანტ-ანგარიშზე ჯერ
არ გაშვებულა — თითოეულზე პირველი ნამდვილი შეკვეთა ერთად ვნახოთ (ტესტ-რეჟიმში, ტესტ-ბარათით).
თუ რომელიმეს პასუხი მოსალოდნელისგან განსხვავდება, ერთ ფაილშია გასასწორებელი:
`src/lib/payments/<პროვაიდერი>.ts`.

---

## 3. რაც ბიზნესის ფაქტებს ითხოვს

### A6 — მაღაზიის რეკვიზიტები

Dashboard → Settings: მისამართი, ტელეფონი, ელფოსტა, სამუშაო საათები, თვითგატანის მისამართი
(თუ გინდა), მიწოდების ზონები და ფასები, დღგ (18% დგას), დაბრუნების ვადა (14 დღე დგას).
ინვოისზე და საკონტაქტო გვერდზე მხოლოდ შევსებული ველები ჩნდება.

ინვოისი ახლა წერს „ეს არ არის ფისკალური დოკუმენტი". ფისკალურად რომ გახდეს, ბუღალტერთან უნდა
შეთანხმდეს ნუმერაცია და რეკვიზიტები; მერე ერთი ველი და ერთი ხაზი დაემატება — ეს ჩემი
ნაწილია.

### A5 — ნამდვილი ფოტოები

ყველა პროდუქტს ერთი placeholder აქვს. Dashboard → Products → პროდუქტი → ფოტოს ატვირთვა
(JPEG/PNG/WebP/AVIF, 2 MB-მდე, რამდენიმეც შეიძლება, აღწერით ორივე ენაზე). ფოტოები ბაზაში
ინახება — ცალკე storage არ სჭირდება.

ფოტოების შემდეგ ღირს README-ს სქრინშოტების გადაღება (§6).

---

## 4. ოპერაციები

- **Uptime** — რომელიმე მონიტორი (UptimeRobot, Better Stack — უფასოა) მიუთითე
  `https://…/api/health`-ზე: 200 ნიშნავს, რომ ბაზაც პასუხობს, 503 — რომ არა. მთავარი გვერდი
  ბაზის გარეშეც 200-ს იძლევა, ამიტომ ის მონიტორად არ გამოდგება.
- **ბექაპები** — ჩვენი არსებობს და აღდგენა შემოწმებულია (`npm run db:backup`,
  `npm run db:restore`). Neon-ის დეშბორდზე შეამოწმე point-in-time recovery-ს ვადა — ის ფარავს
  იმ საათებს, რომელიც ორ ჩვენს ბექაპს შორისაა. ყოველი მიგრაციის წინ `npm run db:backup`.
- **დომენი** — შენი დომენი Vercel-ზე (Settings → Domains), მერე `NEXT_PUBLIC_SITE_URL`,
  Google-ის redirect URI და Resend-ის დომენი შესაბამისად.
- **Staging** — ცალკე მუდმივი staging არ არის საჭირო, სანამ ერთი ადამიანი დეპლოის: CI ყოველ
  push-ზე ცარიელ ბაზაზე ატარებს ყველა მიგრაციას, და production-ის წინ ბექაპია. თუ ორ ადამიანზე
  მეტი დაიწყებს დეპლოის — მაშინ.

---

## 5. ტელეფონზე შესამოწმებელი

ეს დესკტოპზე ვერ მოწმდება. გახსენი ცოცხალი საიტი ტელეფონზე და ნახე:

- „ჭრილიანი" ეკრანი (notch), პორტრეტშიც და ლანდშაფტშიც — header ზედა ზოლის ქვეშ არ უნდა
  შევიდეს, ტექსტი კამერის ქვეშ, „კალათაში" ზოლი და ჩატის ღილაკი ქვედა ინდიკატორის ქვეშ.
  `viewport-fit=cover` ჩართულია და ყველა კიდე დაშორებულია, მაგრამ ნამდვილ ეკრანზე უნდა ინახოს.
- iOS Safari-ში მისამართის ზოლის გაქრობა/გამოჩენა: ფილტრის ფურცელი და ჩატის პანელი ეკრანიდან
  არ უნდა „გადმოცვივდეს".
- გაფორმებისას კლავიატურა ველს არ უნდა ფარავდეს.
- სისტემის პარამეტრებში: 200% ზუმი, „reduce motion" (კუბი და ამანათი უნდა გაჩერდეს),
  Android-ის forced colours.

რაც ვერ იმუშავებს — მითხარი ეკრანით და მოდელით, გავასწორებ.

---

## 6. დოკუმენტაცია, ბოლოს

- სქრინშოტები README-სთვის ორივე ენაზე და ორივე თემაზე — **ფოტოების შემდეგ** (A5), თორემ
  ორმოცჯერ ერთი placeholder-ის სურათი გამოვა.
- A3-ისა და A4-ის შემდეგ README-ს „Notes and known limits" სექცია თავიდან წასაკითხია — ორივე
  ცვლის იმას, რაც იქ წერია.

---

## 7. რიგი

1. **§1** — Vercel-ის ცვლადები (5 წუთი): `CRON_SECRET`, და დარწმუნდი, რომ `PAYMENT_SANDBOX`
   სიაში არ არის
2. **A3** — Resend: ერთი დომენი ექვს წერილს რთავს
3. **A6, A5** — რეკვიზიტები და ფოტოები Dashboard-იდან — ამის შემდეგ საიტი „დემო" აღარ არის
4. **A8, A1** — Sentry, Google
5. **§4** — uptime, Neon-ის retention, დომენი
6. **A4** — გადახდის მეთოდები: PayPal და კრიპტო დღესვე, ბანკები ხელშეკრულების შემდეგ
7. **§5, §6** — ტელეფონი და დოკუმენტაცია, ბოლოს
