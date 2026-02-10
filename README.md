# Studio Maestro OwnerView (V0)

Prototype mobile-oriented OwnerView for studio operations. Stack: Express + TypeScript, Drizzle/Postgres, React (Vite + Wouter), Tailwind/ShadCN UI. Includes PDF import for competition run sheets.

## Prereqs
- Node 18+
- Postgres (connection URL in `DATABASE_URL`)

## Setup
1) `npm install`
2) Copy env: `cp .env.example .env` and set `DATABASE_URL` (Render: use the Render Postgres URL) and `PORT` (default 5000). Optional: `SESSION_SECRET` if sessions added later.

## Dev
- API + Vite middleware: `npm run dev` (uses `server/index.ts`)
- Client-only Vite: `npm run dev:client` (port 5000)
- PDF parser smoke test: `npm run test:pdf:smoke`

Recommended runtime: Node 20 LTS for best native-module compatibility.

## Build / Prod
- Build: `npm run build` (produces `dist/index.cjs` and client build via script/build)
- Start: `npm start`

## Render deploy (recommended commands)
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Env vars: `DATABASE_URL`, `PORT` (optional), `SESSION_SECRET` (if/when auth is added)

## Key API flows
- Run sheet import/review/save:
  - POST `/api/competitions/:competitionId/run-sheet/import` (multipart pdf)
  - GET `/api/competitions/:competitionId/run-sheet`
  - POST `/api/competitions/:competitionId/run-sheet` (bulk save)
  - PATCH `/api/run-sheet/:id` and DELETE `/api/run-sheet/:id`
- Fee generation:
  - POST `/api/competitions/:id/generate-fees` (validates competition.feeStructure shape)

## PDF parsing
- Simple extractor: `server/pdf-extractor.ts` (regex/line-based, used by run-sheet import)
- Pluggable parsers: `server/pdf-parser/` (Velocity/WCDE) available for richer parsing if needed.

### OCR-assisted run-sheet import (new)
- Endpoint: `POST /api/competitions/:competitionId/run-sheet/import` (multipart `pdf`)
- Optional form/query param: `mode` = `auto` | `text` | `ocr`
  - `auto` (default): try text extraction first, OCR fallback if structured rows are not found
  - `text`: text-only extraction
  - `ocr`: OCR-first extraction
- Response includes review metadata:
  - `methodUsed` (`text` | `ocr` | `text+ocr` | `none`)
  - `confidence` (0..1 best-effort score)
  - `warnings` (show to user before save)

Notes:
- OCR uses `tesseract.js` and is intended as a best-effort fallback for scanned docs.
- Scanned PDF path now rasterizes pages via `pdfjs-dist` + `@napi-rs/canvas` before OCR for improved recognition quality.

## Notes
- PDF uploads limited to 10MB, in-memory (multer). Consider external storage for larger files.
- Drizzle config: `drizzle.config.ts`; schema in `server/schema.ts`.
