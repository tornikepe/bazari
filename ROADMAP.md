# Bazari — რა დარჩა

საიტი ცოცხალია: `https://bazari-tornikepes-projects.vercel.app`. Vercel, Sentry, Google-ით
შესვლა, UptimeRobot — მუშაობს. ბაზა ცარიელია, ბექაპები `backups/`-შია.

Vercel-ის ცვლადი: Vercel → bazari → Settings → Environment Variables → Add → Save →
Deployments → ბოლო → ⋯ → Redeploy.

## 1. პროდუქტები — როცა გექნება
Dashboard → პროდუქტები: ფოტო, აღწერა (ქარ/ინგ), ფასი, თვითღირებულება, მარაგი.
ბევრი ერთად — `npm run db:import -- manifest.json` (ფორმატი სკრიპტის თავშია).
ახლა საიტზეა: 40 სატესტო პროდუქტი და 30 ფეხსაცმელი dressup.ge-ს ფოტოებით (დემოსთვის —
ნამდვილი გაყიდვისთვის საკუთარი ან მომწოდებლის ფოტოები დაგჭირდება). გაშვებამდე წაშალე/შეცვალე.

## 2. რეკვიზიტები
Dashboard → პარამეტრები: ტელეფონი, ელფოსტა, მისამართი, სამუშაო საათები, მიწოდების
ფასები. Dashboard → გვერდები: ტექსტები, თუ რამე შესაცვლელია.

## 3. დომენი — როცა იყიდი
1. Vercel → Settings → Domains → დაამატე, DNS ჩაწერე.
2. Vercel ცვლადი `NEXT_PUBLIC_SITE_URL` = `https://დომენი`.
3. Google Cloud (`bazari-508917`) → Clients → redirect URI `https://დომენი/api/auth/google/callback`.
4. UptimeRobot-ში URL შეცვალე.

## 4. ელფოსტა (Resend) — დომენის შემდეგ
ამის გარეშე შეკვეთის წერილი, კოდი და პაროლის აღდგენა არ იგზავნება.
resend.com → Domains → Add → 3 DNS ჩანაწერი → Verify → API Keys → Create →
Vercel: `RESEND_API_KEY`, `MAIL_FROM` = `Bazari <noreply@დომენი>`.

## 5. ონლაინ გადახდა — რეგისტრაციის შემდეგ (პ. 7)
Dashboard → გადახდები, თითო პროვაიდერს თავისი ბარათი და ტესტ-რეჟიმი აქვს.
PayPal: developer.paypal.com → Create App. Coinbase: commerce.coinbase.com → API keys.
TBC/BOG: ხელშეკრულება ბანკთან. პირველი ნამდვილი გადახდა ერთად ვნახოთ ტესტ-რეჟიმში.

## 6. სურვილისამებრ
Facebook-ით შესვლა: developers.facebook.com → App → Facebook Login → redirect
`https://დომენი/api/auth/facebook/callback` → Vercel `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`.

## 7. რეგისტრაცია — ონლაინ გადახდის ჩართვამდე, ან როცა გაყიდვები რამდენიმე ათეულს გადააჭარბებს
ინდ. მეწარმე (იუსტიციის სახლი / my.gov.ge, ერთი დღე, ~20–50 ₾) + მცირე ბიზნესის სტატუსი
(ბრუნვის 1%). ბანკები და PayPal ამის გარეშე მერჩანტ-ანგარიშს არ აძლევენ.

---
რიგი: 1 → 2 → 3 → 4 → 5. ყველა პუნქტი შენს ნაბიჯს ელოდება. რაც გაკეთდება, აქედან წაიშლება.
