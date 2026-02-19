# Finance → Tuition Phase 1 Handoff (Owner Accounting Hub)

Date: 2026-02-18 (late-night checkpoint)

## Current checkpoint

- Repo status: **clean** (no local edits staged or unstaged)
- Branch: `main`
- HEAD: `e362e4c`
- This means we only completed **analysis/discovery**, not implementation yet.

---

## What was confirmed during analysis

### Existing backend/data shape
- `server/schema.ts` currently has:
  - `dancers` table with `age`, `level`, `dateOfBirth` (all currently permissive)
  - `fees` table as current money table (legacy-style, includes `fee_type`, `accounting_code`)
- Finance endpoints currently implemented in `server/routes.ts`:
  - `GET /api/finance/dancer-accounts`
  - `GET /api/finance/dancers/:dancerId/ledger`
- Data access currently in `server/storage.ts` (`getFees/createFee/updateFee/deleteFee`)

### Existing frontend shape
- Current Finance page is `client/src/pages/Finance_OwnerView_mobile.tsx`
  - Top cards and tab bar already present (must preserve)
  - Tuition tab bottom section is currently a Jan–Dec toggle grid (to replace)
- Existing `client/src/components/finance/TuitionHubPanel.tsx` has some prior account/ledger UI patterns that can be reused
- Data hooks are in `client/src/hooks/useData.ts`

### Migration/system notes
- Existing SQL migrations are additive:
  - `migrations/0001_add_dancer_age_level.sql`
  - `migrations/0002_add_fee_type_and_accounting_code.sql`
- Startup schema safety logic exists in `server/migrations.ts`

---

## Tomorrow’s implementation plan (in safe order)

## 1) Schema + migration (additive only)

Edit: `server/schema.ts`, new SQL migration `migrations/0003_finance_phase1_hub.sql`

### Dancers
- Add/ensure:
  - `birthdate` (date-like storage in this codebase likely `text("birthdate")` for compatibility)
  - `level` normalized to lower-case enum-like values (`mini|junior|teen|senior|elite`)
  - `isCompetitionDancer` boolean default false

### New tables
- `events`
- `event_fees`
- `transactions` (canonical ledger for all charges/payments)
- Optional: `fee_types` defaults table (only if useful; otherwise keep defaults in code)

### Transactions fields (required)
- `type`: `charge | payment`
- `fee_type`: `tuition | costume | competition | recital | other`
- `amount` numeric(10,2)
- `event_fee_id` nullable FK
- QB/Wave mapping fields + external IDs + `sync_status`

### Backfill strategy
- Keep legacy `fees` table untouched for now.
- Backfill `transactions` from existing `fees` rows using SQL insert-select:
  - legacy unpaid fee -> create `charge` transaction
  - legacy paid fee -> create `charge` and `payment` rows (or a single paid-adjusted pattern, but split rows is cleaner ledger)

## 2) Storage layer

Edit: `server/storage.ts`

Add methods for:
- `getFinanceDancers(params)` with server-side sort/filter
- `getDancerTransactions(dancerId)` with running balance
- events CRUD-lite (`list/create/update`)
- `createEventFeeAndChargeTransaction(...)`
- `createPaymentTransaction(...)` + `recalculateEventFeeBalanceStatus(...)`

## 3) API routes

Edit: `server/routes.ts`

Add/replace with Phase 1 endpoints:
- `GET /api/finance/dancers`
  - supports sort/filter query params from spec
- `GET /api/finance/dancers/:dancerId/transactions`
- `GET /api/finance/events`
- `POST /api/finance/events`
- `PATCH /api/finance/events/:id`
- `POST /api/finance/event-fees`
- `POST /api/finance/payments`

Keep old endpoints temporarily only if needed by old components, but switch Finance page to new endpoints.

## 4) Frontend hooks/types

Edit: `client/src/hooks/useData.ts` (+ optional shared types file)

Add typed hooks for:
- finance dancer list query w/ params
- dancer transactions query
- events query
- record payment mutation

## 5) Finance page refactor (core UI)

Edit: `client/src/pages/Finance_OwnerView_mobile.tsx`

Requirements:
- Preserve top cards + tab nav (Tuition/Comp Fees/Costumes)
- Replace Tuition tab bottom Jan–Dec tracker with **Dancer Finance Hub**:
  - Left/top: dancer table with sort/filter controls
  - Right/bottom: selected dancer ledger card + recent activity table
- Maintain mobile-first responsiveness

Suggested component split for cleaner continuation:
- `client/src/components/finance/DancerFinanceTable.tsx`
- `client/src/components/finance/SelectedDancerLedger.tsx`
- (optional) `client/src/components/finance/FinanceFiltersBar.tsx`

## 6) Seed updates

Edit: `script/seed-demo.ts` (and optionally `server/seed.ts`)

Add minimal demo data:
- 3 events (recital, regional comp, nationals)
- several `event_fees` with paid/unpaid/partial
- realistic `transactions` rows per dancer (tuition + event + payments)

## 7) Validate

Run:
- `npm run check`
- `npm run dev:win`

Manual verify on `/finance`:
- sorting/filtering server-driven
- default selected dancer
- ledger renders with running balance
- payment recording updates event fee status

---

## Fast restart commands for tomorrow

```bash
git status --short --branch
git pull --rebase
npm run check
npm run dev:win
```

---

## Notes to future self (important)

- Existing system stores many date/money values as `text`; keep migration safe and consistent with current architecture.
- Don’t break existing Finance tab navigation or Comp Fees/Costumes tabs.
- Keep all QB/Wave integration as **data fields only** (no external API calls this phase).
- Prioritize additive changes and backward compatibility over deep rewrites.
