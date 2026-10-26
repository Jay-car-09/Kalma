# Kalma — Project Brief for the AI Builder

> Read this whole file before every task. It is the source of truth.
> If a request conflicts with this file, stop and ask the owner.
> Slogan: **"Keep calm. Stay on track."** / **"Kalma lang. On track ka."**

---

## 1. What Kalma is

A calm, manual-entry **debt tracker** for Filipino users (iOS + Android, one codebase).
Each debt is a **tracker** — a reminder-style entry: who, how much, when, and whether to notify.
It tracks and reminds. It does **not** calculate interest, plan payoffs, give advice, scan bills, or import data.

The owner is a non-developer building with AI help. So:
- Make small, focused changes. One feature per task.
- Explain what you changed in plain language, and how to test it on the phone.
- Never add a library that isn't listed in section 9 without asking first.
- Never put passwords, API keys or secrets in the code.
- If an error happens, explain the cause simply before fixing it.

---

## 2. Launch scope (v1) — IN

- **4 bottom tabs:** Home (dashboard) · Trackers · Settings · Account
- **Add tracker** — a quick, reminders-style sheet. Top switch: **I owe / Owed to me**.
- **Mark as Paid** (or **Received** for "Owed to me") → logs a payment; recurring rolls to the next due date; one-time becomes **Done**.
- **Payment history** per tracker (edit/delete entries).
- **Dashboard + analytics** (same on both tiers, descriptive only — no projections).
- **Local reminders** driven by urgency (section 4).
- **Guest mode** (on-device only) and **Account mode** (cloud sync) — Account mode is a later phase.
- **Free vs Paid** tiers (section 5). **Ads** on Free (section 6).
- **English + Tagalog** from day one (section 8).
- **Light / Dark / Follow system** themes.
- **Optional app lock** (Face ID / fingerprint / phone passcode), off by default.
- **CSV export** of the user's own data (Account tab).

## 3. OUT — do not build

- **Never:** bill/statement/screenshot scanning or OCR; bank/GCash/Maya linking; SMS/email reading; any automatic import; video ads, interstitials, rewarded ads.
- **Not in v1 (future modules):** payoff planner, subscription tracker, credit card cutoff optimizer, insurance/HMO tracker, points/rewards expiry, ipon challenge, document expiry tracker.
- **Also not in v1:** interest math, projections, payoff dates, advice, in-app bill payment, messaging borrowers, shared debts, non-peso currencies, attachments, email/SMS reminders, calendar sync, widgets, web/desktop, phone-contacts access.

---

## 4. The tracker

### Fields (Add sheet, in this order)
| # | Field | Rules |
|---|---|---|
| — | Direction | `I owe` / `Owed to me` (switch at top) |
| 1 | Name | Free text. Lender or borrower. Autocomplete from names typed before. |
| 2 | Amount (₱) | What is paid **each time** (recurring) or the **full amount** (one-time) |
| 3 | Type | Credit card · Personal/bank loan · BNPL · Online lending app · SSS salary loan · Pag-IBIG salary loan · Informal utang · Other |
| 4 | Due date | Quick picks (Today, Tomorrow, Next week) + date picker |
| 5 | Recurring | One-time · Weekly · Twice a month (two days of month) · Monthly · Custom: every N days/weeks/months |
| 6 | Urgency | Low / Normal (default) / High — set by user |
| 7 | Notify | On/Off. Defaults On if a slot is free; at the cap shows Off with a one-line reason |

**More details** (collapsed, optional): remaining balance, interest rate (stored/display only — never calculated), statement cutoff day (credit cards only), notes.

### Urgency controls notifications
| Urgency | Before due | If overdue |
|---|---|---|
| Low | Due day only | One nudge next day |
| Normal | 3 days before + due day | Nudges 1 and 3 days after |
| High | 7, 3, 1 days before + due day | Daily nudge until paid, max 7 days |

- Notify Off = no notifications, regardless of urgency.
- Skip any "before" reminder that would land before the previous occurrence (short intervals).
- Default delivery time 9:00 AM (changeable in Settings).
- Urgency is shown in **greyscale only** (High = solid black chip, Normal = outlined, Low = light grey). Never red/green.

### Data model
**Pending — Section 2 of the spec.** Do not build tracker storage until it is added here.

---

## 5. Tiers

| | Free | Paid |
|---|---|---|
| Trackers stored | **10 total** (active, done AND archived all count) | Unlimited |
| Notified trackers | **5** | Unlimited |
| Dashboard & analytics | Yes | Yes |
| Ads | Yes | No |

- One debt = one tracker. Owed-to-me trackers count too.
- Archiving does **not** free a slot. Only deleting does (warn: deleting also removes history).
- 11th tracker on Free → blocked, calm prompt: upgrade, or delete one.
- 6th Notify on Free → blocked, prompt: turn another off, or upgrade.
- Until real purchases exist, tier is controlled by a single **`isPaid`** flag with a dev-only "Pretend Paid" switch.

## 6. Ads (Free tier only)
- **Banner:** one fixed spot, directly **above the tab bar**, on every screen. Until AdMob is added, render a calm greyscale placeholder of the same size (standard banner, 320×50).
- **Poster popup:** one quick static image, closeable instantly with a clear ✕. Never video, never blocking. (Built in a later phase.)
- Both must sit inside the monochrome design — neutral frame, no bright borders.

---

## 7. Design system

**Vibe:** sharp, modern fintech, calm. Original — do not imitate any existing app.
**Rule:** monochrome. Color is **semantic only**: red = overdue, green = paid/done. Everything else is greyscale.

### Color tokens (v1 proposal — owner may tune)
| Token | Light | Dark |
|---|---|---|
| background | #FFFFFF | #0E0E0E |
| surface (cards) | #F6F6F6 | #1A1A1A |
| border | #E5E5E5 | #2A2A2A |
| textPrimary | #0A0A0A | #F5F5F5 |
| textSecondary | #5C5C5C | #A3A3A3 |
| textTertiary | #8A8A8A | #737373 |
| inverse (High chip, primary button) | #0A0A0A bg / #FFFFFF text | #F5F5F5 bg / #0A0A0A text |
| overdue | #C62828 | #EF5350 |
| overdueBg | #FDECEC | #3A1C1C |
| paid | #2E7D32 | #66BB6A |
| paidBg | #EAF5EB | #17301B |

- "Due soon" = greyscale badge (not colored). Only overdue and paid get color.
- Alerts are a colored **card tint or badge** — never full-screen, never flashing, no alarm icons.

### Spacing & shape
- Spacing scale: 4, 8, 12, 16, 24, 32, 48. Screen side padding: 24.
- **Spacious:** few elements per screen, generous whitespace.
- Card radius 12, chip radius 8. Hairline borders, no heavy shadows.

### Typography
- Font: **Inter** (via `@expo-google-fonts/inter`).
- Scale: hero number 40 · title 24 · heading 18 · body 16 · caption 13.
- **All money amounts use tabular numbers** (`fontVariant: ['tabular-nums']`) and one shared `<Amount>` component.
- Peso format: `₱2,450.00` (locale en-PH).

---

## 8. Localization (EN + TL)
- **No hard-coded user-facing text.** Every string lives in `en.json` and `tl.json`.
- Default language follows the phone; user can switch in Settings; choice is remembered.
- Tagalog should be natural, everyday Filipino (Taglish is fine where Filipinos naturally use English, e.g. "due date"). The owner reviews all Tagalog.
- Layouts must allow longer Tagalog text without breaking.

---

## 9. Tech stack (approved)
- **Expo** (latest SDK that the store version of Expo Go supports) + **React Native** + **TypeScript**
- **Expo Router** — file-based navigation, bottom tabs
- **i18next + react-i18next + expo-localization** — translations
- **@expo-google-fonts/inter** — font
- **@react-native-async-storage/async-storage** — small settings only (theme, language, flags)
- **@expo/vector-icons** — monochrome icons
- Later phases (do not add yet): local database, expo-notifications, cloud backend (likely Supabase), AdMob, RevenueCat, expo-local-authentication.

## 10. Build phases
1. **Phase 1 (Expo Go, free):** guest mode — foundation, trackers, dashboard, reminders, EN/TL, themes, app lock, tier limits on the `isPaid` flag.
2. **Phase 2 (Expo Go, free):** accounts, cloud sync, security, guest → account upgrade.
3. **Phase 3 (own builds, paid store accounts):** real ads + Paid subscription.
4. **Phase 4:** beta (15–20 testers, 14+ days) → store submission.

## 11. Future-proofing (keep in mind, don't build)
Future modules will plug into: the tracker data model, the reminders engine, the dashboard (as new cards), the account system, and this design system. Build each of those as shared, reusable pieces — not tied only to debts.
