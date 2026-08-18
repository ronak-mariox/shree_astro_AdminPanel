# Shree Astro — Admin Panel

The web console behind the two mobile apps. It covers the admin-side modules of the
FRD: user management, astrologer approval, consultation monitoring, payments,
wallets, content, horoscopes, notifications, reporting and platform settings.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run lint
```

Sign in with **admin@shreeastro.com / shreeastro**, then any six digits at the OTP
step. Data is mocked in `src/data` — no backend is wired up yet.

## Design

The visual language is lifted from `user_app/src/theme` and `astro_app/src/theme`
so the three surfaces read as one product:

| Token | Value | Where it came from |
| --- | --- | --- |
| Brand yellow | `#F0DF20` | both apps' hero |
| CTA gradient | `#F55102 → #FFBC01` | `PrimaryButton` / `BrandGradient` |
| Canvas | `#FAF9F7` / `#FFFDF8` | app canvas |
| Ink | `#131110` | the apps' filled dark CTA, used here for the sidebar |
| Text | `#1F2937` / `#6B7280` / `#9CA3AF` | `colors.text` |
| Radii | 12 / 16 / 20 / 22 px | `layout.ts` |
| Type | Poppins (display) + Inter (UI) | bundled from both apps' `assets/fonts` |

Everything lives in CSS custom properties in [src/styles/tokens.css](src/styles/tokens.css);
change a value there and the whole console follows.

## Structure

```
src/
  App.jsx              login gate + hash router + shell
  styles/              tokens → base → layout → components → pages
  components/
    Shell.jsx          sidebar, topbar, page header
    ui.jsx             buttons, cards, badges, forms, drawers, modals, toasts
    DataTable.jsx      search + sort + paging table used by every listing
    Charts.jsx         area / bar / donut / sparkline, hand-drawn SVG
    Icon.jsx           the icon set (no icon dependency)
  pages/               one file per module
  data/                mock records, named to match the mobile apps
  hooks/               hash router + toasts
```

No runtime dependencies beyond React — the router, charts, icons and table are all
in-repo, so nothing needs re-theming when the brand moves.

## Pages

| Route | Module |
| --- | --- |
| `#/dashboard` | KPIs, revenue, consultation mix, live sessions, activity feed |
| `#/users` | Seeker directory, birth details, block / unblock |
| `#/astrologers` | Applications, document verification, rates, suspension |
| `#/consultations` | Chat & voice sessions, billing split, transcripts, disputes |
| `#/payments` | Razorpay orders, settlement, refunds, verification trail |
| `#/wallets` | Balances, movement ledger, payout queue, manual adjustments |
| `#/content` | Article library with the create / publish / visibility editor |
| `#/horoscope` | Today's reading per sign, with the app preview |
| `#/notifications` | Push campaigns, automated alerts, delivery health |
| `#/reports` | Activity, retention, saved reports, API monitoring |
| `#/settings` | Commission, feature switches, admin team, integrations |

## Wiring it to the backend

Each page reads from a module in `src/data`. Replace those exports with API calls
(the shapes are stable) and the pages need no other change. Actions currently raise
a toast through the `notify` prop passed into every page — that is the hook point
for the real mutation.
