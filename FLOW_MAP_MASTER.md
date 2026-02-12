# Studio Maestro OwnerView — Master Map

This file saves the complete architecture + flow mapping content for planning your flow diagram work.

## 1) System Map (Big Picture)

```text
[Mobile Owner UI (React/Vite)]
  ├─ Pages (Dashboard, Dancers, Routines, Competitions, Finance, Messages, etc.)
  ├─ Data Hooks (client/src/hooks/useData.ts)
  └─ Calls REST API (/api/...)

[Express Server]
  ├─ Routing layer (server/routes.ts + feature route files)
  ├─ Storage layer (server/storage.ts)
  ├─ Schema/Types (server/schema.ts)
  └─ DB access (server/db.ts via Drizzle)

[Database]
  ├─ Core studio entities (dancers, routines, competitions, fees, etc.)
  └─ Messaging entities (chat_threads, participants, messages, reads)
```

---

## 2) Frontend Page Map (Owner View)

Main owner mobile pages:
- Dashboard
- Dancers
- Routines
- Competitions
- Finance
- Messages / CompChat
- Announcements
- Policies
- Recitals
- Studio / Studio Settings

Supporting parent pages also exist (ParentBilling, ParentClasses, ParentContacts, ParentPolicies).

---

## 3) Domain/Data Map

### Core Domains
- **Dancers**
- **Routines**
- **Competitions**
- **Fees** (Tuition / Competition / Costume)
- **Announcements**
- **Policies + Policy Agreements**
- **Recitals + Recital Lineup**

### Messaging/CompChat Domain
- `chat_threads`
  - type: `direct_parent_staff | compchat | group_broadcast`
  - flags: `staffOnlyBroadcast`, `isTimeSensitive`, `expiresAt`
- `chat_thread_participants`
  - `participantId`, `participantRole`, `authorized`
- `chat_messages`
  - sender + body + `isStaffBroadcast`
- `chat_message_reads`
  - read receipts by reader

---

## 4) API Flow Map (Messaging)

```mermaid
flowchart TD
  A[Messages UI] --> B[GET /api/chat/threads]
  A --> C[POST /api/chat/threads]
  A --> D[GET /api/chat/threads/:id/messages]
  A --> E[POST /api/chat/threads/:id/messages]
  A --> F[POST /api/chat/messages/:id/read]
  A --> G[GET /api/chat/threads/:id/read-summary]

  B --> H[server/routes.ts]
  C --> H
  D --> H
  E --> H
  F --> H
  G --> H

  H --> I[server/storage.ts]
  I --> J[(DB)]
```

Rules enforced in routes:
- Only `owner/staff` can create staff-only broadcasts and send staff broadcast messages.
- Participants must be authorized (or be studio staff).
- Read receipts are recorded per message and summarized per thread.

---

## 5) API Flow Map (Finance)

```mermaid
flowchart TD
  A[Finance Page] --> B[useFees/useDancers/useCompetitions/useRoutines]
  B --> C[/api/fees, /api/dancers, /api/competitions, /api/routines]
  A --> D[useUpdateFee/useCreateFee/useUpdateRoutine]
  D --> E[PATCH/POST endpoints]
  E --> F[storage.ts]
  F --> G[(DB)]
```

Finance behavior:
- Tuition rates are manual numeric inputs by group.
- Tuition matrix is built by dancer x month.
- Paid/unpaid toggles update existing fees or create virtual→real fee entries.

---

## 6) Recommended Diagram Pack

Suggested diagram set for full product mapping:
1. **System Context** (Client ↔ API ↔ DB)
2. **Navigation Flow** (Owner page-to-page)
3. **Finance Flow** (rates → matrix → fee updates)
4. **CompChat Flow** (thread create → message send → read receipts)
5. **Competition Fee Flow** (competition select → fee entries → paid tracking)
6. **Costume Fee Edit Flow** (fee edit + routine costume name sync)

---

## 7) Master Flow Diagram (Combined)

```mermaid
flowchart TB

  %% =========================
  %% CLIENT
  %% =========================
  subgraph CLIENT[Client App - React/Vite]
    NAV[AppShell + Layout + Navigation]

    subgraph PAGES[Owner Pages]
      DASH[Dashboard]
      DANCERS[Dancers]
      ROUTINES[Routines]
      COMP[Competitions]
      FIN[Finance]
      MSG[Messages / CompChat]
      ANN[Announcements]
      POL[Policies]
      REC[Recitals]
      STUDIO[Studio / Settings]
    end

    HOOKS[Data Hooks - useData.ts]

    NAV --> DASH
    NAV --> DANCERS
    NAV --> ROUTINES
    NAV --> COMP
    NAV --> FIN
    NAV --> MSG
    NAV --> ANN
    NAV --> POL
    NAV --> REC
    NAV --> STUDIO

    DASH --> HOOKS
    DANCERS --> HOOKS
    ROUTINES --> HOOKS
    COMP --> HOOKS
    FIN --> HOOKS
    MSG --> HOOKS
    ANN --> HOOKS
    POL --> HOOKS
    REC --> HOOKS
    STUDIO --> HOOKS
  end

  %% =========================
  %% SERVER
  %% =========================
  subgraph SERVER[Server - Express]
    API[API Routes - server/routes.ts + feature routes]
    AUTHZ[Role + Authorization Checks]
    STORAGE[Storage Layer - server/storage.ts]
    SCHEMA[Schema + Types - server/schema.ts]
  end

  %% =========================
  %% DB
  %% =========================
  subgraph DB[Database]

    subgraph CORE[Core Tables]
      T_DANCERS[dancers]
      T_ROUTINES[routines]
      T_COMP[competitions]
      T_FEES[fees]
      T_ANN[announcements]
      T_POL[policies]
      T_POLA[policy_agreements]
      T_REC[recitals]
      T_RECL[recital_lineup]
    end

    subgraph CHAT[Messaging Tables]
      T_THREAD[chat_threads]
      T_PART[chat_thread_participants]
      T_MSG[chat_messages]
      T_READ[chat_message_reads]
    end
  end

  %% CLIENT -> SERVER
  HOOKS --> API

  %% SERVER internals
  API --> AUTHZ
  AUTHZ --> STORAGE
  STORAGE --> SCHEMA

  %% SERVER -> DB
  STORAGE --> T_DANCERS
  STORAGE --> T_ROUTINES
  STORAGE --> T_COMP
  STORAGE --> T_FEES
  STORAGE --> T_ANN
  STORAGE --> T_POL
  STORAGE --> T_POLA
  STORAGE --> T_REC
  STORAGE --> T_RECL

  STORAGE --> T_THREAD
  STORAGE --> T_PART
  STORAGE --> T_MSG
  STORAGE --> T_READ

  %% =========================
  %% FINANCE FLOW
  %% =========================
  subgraph FLOW_FIN[Finance Flow]
    F1[Finance page loads]
    F2[Fetch dancers + fees + competitions + routines]
    F3[Build tuition matrix by dancer x month]
    F4[Manual rate input per group]
    F5[Toggle paid/unpaid]
    F6[Create or update fee records]
  end

  FIN --> F1 --> F2 --> F3 --> F4 --> F5 --> F6 --> API

  %% =========================
  %% MESSAGING FLOW
  %% =========================
  subgraph FLOW_MSG[Messages / CompChat Flow]
    M1[List threads]
    M2[Create thread]
    M3[Add participants]
    M4[Send message]
    M5[Mark read]
    M6[Read summary]
    M_RULES[Rules: staff-only broadcast + participant authorization]
  end

  MSG --> M1 --> API
  MSG --> M2 --> API
  MSG --> M3 --> API
  MSG --> M4 --> API
  MSG --> M5 --> API
  MSG --> M6 --> API
  API --> M_RULES

  %% =========================
  %% COMP / COSTUME FLOWS
  %% =========================
  subgraph FLOW_COMP[Competition Fee Flow]
    C1[Select competition]
    C2[Load linked fee entries]
    C3[View total / paid / outstanding]
    C4[Toggle fee paid]
  end

  COMP --> C1 --> C2 --> C3 --> C4 --> API

  subgraph FLOW_COST[Costume Fee Edit Flow]
    K1[Open dancer costume fees]
    K2[Edit costume fee amount]
    K3[Optionally sync routine costume name]
    K4[Save updates]
  end

  FIN --> K1 --> K2 --> K3 --> K4 --> API
```

---

## 8) Optional Simplified Diagram Prompt

If you want a non-technical stakeholder version, use this prompt as a starter:

> “Create a simple user journey diagram showing Owner navigation across Finance, Competitions, and Messages/CompChat, including key actions (view totals, mark paid, send broadcast, mark read) and outcomes.”
