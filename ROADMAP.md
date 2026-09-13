# Bazari — to do

Only what is left. ⛔ marks work blocked on something that cannot be produced here. What was
done, and why, is in the commit messages and the README; it is not repeated here.

---

## 1. Responsive — needs a real phone

- ⛔ `env(safe-area-inset-*)`: add `viewport-fit=cover` together with insets on every edge.
  Cannot be verified without **A7**
- Open the site at 200% zoom, in forced colours, and with reduced motion — on the device,
  not in an emulator

---

## 2. Shop features

| | Item | What it needs |
|---|---|---|
| 🔴 | Payment | An implementation behind the adapter interface. Blocked on **A4** |

Everything that emails a shopper — the confirmation with its PDF, the shipping notice, the
return answer, the abandoned-cart reminder, the back-in-stock message — is written and goes
to the server log until **A3**.

---

## 3. Testing

- Run `npm run load` once against the deployed site (`LOAD_URL=https://…`), gently — the
  figures measured here go through a database on another continent and say more about the
  round trip than about the pages

---

## 4. Operations

- Error tracking — Sentry with source maps. Blocked on **A8**
- Uptime alerting to your phone — point the monitor at `/api/health`, which answers 503
  when the database does not; the page itself would answer 200 with no products on it
- Backups: confirm retention, and restore once to prove it works
- A custom domain
- A staging database, so migrations are rehearsed before production. (`npm run
  test:e2e:scratch` rehearses every migration on a throwaway database each time it runs,
  which is most of what a staging database is for)

---

## 5. Documentation, at the end

- Screenshots that match what ships, in both languages and both themes — after **A5**, or
  they are screenshots of one placeholder photo forty times
- Read the README top to bottom once more after **A3** and **A4** land, since both change
  what the "honest limits" say

---

## 6. What only you can do

| | What | Why it is yours |
|---|---|---|
| **A1** | `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` | The console is signed into as you, and the secret is a secret |
| **A2** | Check `AUTH_SECRET` on Vercel — if it is still the public placeholder, session cookies can be forged | Only you can read your project's environment |
| **A3** | A sending domain verified in Resend, and `RESEND_API_KEY` | Domain ownership. Until then no customer email is sent at all |
| **A4** | A payment provider application | A business relationship, and it takes weeks |
| **A5** | Real product photographs | Nobody can invent a photo of a product that exists |
| **A6** | Real business details — address, phone, hours, tax ID | They are facts about a business |
| **A7** | A full Xcode install, then `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer` | It needs your password |
| **A8** | A Sentry account | An account and a billing decision |
| **A9** | Run the new migrations against production: `npm run db:migrate` (or `prisma migrate deploy`) after merging — seven of them, all additive | They were rehearsed on a throwaway database, not on yours |
| **A10** | Set `CRON_SECRET` in the Vercel project (any long random string) | Without it the daily sweep refuses every call, and no cart reminder or payment expiry ever runs |
| **A11** | Refresh the visual baselines on your machine: `npm run test:visual:update`, then take the Linux pair from CI | The baselines are pictures of your database's newest products; the deals banner and the product page changed on purpose |

```bash
# A1 — register the client at console.cloud.google.com/apis/credentials with these
#      redirect URIs, character for character:
#        http://localhost:3000/api/auth/google/callback
#        https://bazari-git-main-tornikepes-projects.vercel.app/api/auth/google/callback
GOOGLE_CLIENT_ID="…"
GOOGLE_CLIENT_SECRET="…"
```

```bash
# A2 — replacing it signs everyone out, which is the correct outcome.
npm run setup:credentials -- --force   # locally; set the Vercel one by hand
```

---

## 7. Order of work

1. **A9** and **A10** — the migrations and the cron secret, before anything else ships
2. **A3** — it switches on six emails that are already written
3. **§4** and **§5**, last
4. **§1** whenever a real phone is to hand
