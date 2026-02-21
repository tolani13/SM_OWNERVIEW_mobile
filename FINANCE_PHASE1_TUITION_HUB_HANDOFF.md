# Finance → Tuition Phase 1 Handoff (Owner Accounting Hub)

Date: 2026-02-20 (accounting provider integration checkpoint)

## ✅ Latest implementation checkpoint (new)

This handoff was updated after implementing **QuickBooks + Xero provider plumbing** for Finance sync.

### What is now implemented

- Added provider-agnostic accounting integration schema in `server/schema.ts`:
  - `accounting_connections`
    - one row per studio/provider
    - supports `quickbooks` and `xero`
    - tracks active provider lock (`is_active`), token state, tenant/realm metadata, and last error/sync timestamps
  - `accounting_sync_records`
    - per-transaction provider mapping
    - idempotency key + fingerprint safeguards
    - external object ID tracking (invoice/payment)
    - retry/error status model
  - Added Xero defaults on `fee_types`:
    - `default_xero_revenue_account_code`
    - `default_xero_payment_account_code`

- Extended startup migration logic in `server/migrations.ts` to auto-ensure:
  - new `fee_types` Xero columns
  - `accounting_connections` + unique `(studio_key, provider)` index
  - `accounting_sync_records` + unique `(studio_key, provider, transaction_id)` and `(studio_key, provider, idempotency_key)` indexes
  - default connection seeds for studio `default` with both providers disconnected

- Added new backend route module `server/accounting-routes.ts` and wired it into `server/routes.ts`:
  - OAuth/connect endpoints:
    - `POST /api/accounting/connect/:provider`
    - `GET /api/accounting/callback/quickbooks`
    - `GET /api/accounting/callback/xero`
  - connection management:
    - `GET /api/accounting/connections`
    - `POST /api/accounting/activate/:provider`
    - `POST /api/accounting/disconnect/:provider`
  - sync + reconciliation endpoints:
    - `POST /api/accounting/sync/run`
    - `GET /api/accounting/sync-records`

### Provider architecture behavior

- One active write provider per studio via `is_active` enforcement (`setActiveProvider`).
- OAuth state and PKCE verifier handling for Xero in-memory state store (short-lived).
- QuickBooks token exchange/refresh and realm-based API routing.
- Xero PKCE token exchange/refresh plus tenant discovery via `/connections`.
- Transaction sync adapter picks provider at runtime and maps:
  - `charge` → external invoice
  - `payment` → external payment/sales receipt flow
- Sync is idempotent using stable key hash derived from studio/provider/transaction payload.
- Sync writes back to:
  - `accounting_sync_records` (status/external IDs/errors)
  - `transactions.sync_status` (`pending|synced|failed`)
  - `accounting_connections.last_error/last_synced_at/status`

### Environment config template updated

- `.env.example` now includes required QB/Xero vars for auth + sync defaults.

### Notes / caveats

- Existing local unrelated file edits are still present in working tree:
  - `client/src/components/finance/TuitionHubPanel.tsx`
  - `client/src/hooks/useData.ts`
- New integration code is backend-first and API-driven; no Finance UI wiring added yet for these new endpoints.
- Typecheck should be rerun after final env and any pending merge cleanup.

---

## Previous checkpoint (kept for context)

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
