# Project Overview

Collaborative whiteboard POC inspired by Miro. Demonstrates real-time synchronization of sticky note positions, text content, and user cursors across browser tabs/clients.

## Tech Stack

- **Frontend:** React 19, Vite 8, Tailwind CSS v3, lucide-react icons
- **Backend/Realtime:** Supabase (local Docker via CLI v2.75+)
- **CRDT:** Yjs with `y-supabase` provider (alpha)

## Architecture

"Unified Yjs" approach: spatial coordinates (X/Y), colors, and text content all live in a single Yjs document. The `y-supabase` provider broadcasts CRDT updates via Supabase Realtime and persists binary document state to the `yjs_updates` Postgres table.

Conceptual docs (`01_CONCEPT.md`, `02_META_MODEL.md`) outline future plans for a strict Meta-Model with schema validation and entity relations.

## Project Structure

```
miro-poc/                    # Main application directory
├── src/
│   ├── App.jsx              # Main canvas component with Yjs integration
│   ├── StickyNote.jsx       # Draggable sticky note component
│   ├── lib/supabase.js      # Supabase client initialization
│   ├── main.jsx             # React entry point
│   ├── index.css            # Tailwind imports
│   └── App.css              # App-specific styles
├── supabase/
│   ├── config.toml          # Local Supabase configuration
│   ├── migrations/          # SQL migrations (boards + yjs_updates tables)
│   └── seed.sql             # Seeds default board (UUID 00000000-...)
├── .env                     # Local env vars (not committed)
├── .env.example             # Template: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Database Schema

- **boards** — `id` (uuid PK), `name`, `created_at`. RLS enabled with public access policy.
- **yjs_updates** — `id` (uuid PK), `board_id` (FK to boards), `document_update` (bytea), `created_at`. Published to `supabase_realtime`. RLS enabled with public access policy.
- **Seed data:** One default board with UUID `00000000-0000-0000-0000-000000000000`.

## Building and Running

All commands run from the `miro-poc/` directory.

### Local Supabase

```bash
cd miro-poc
npx supabase start    # Start services, apply migrations & seed
npx supabase stop     # Stop services
```

### Frontend Dev Server

```bash
cd miro-poc
npm install
npm run dev           # Vite dev server
npm run build         # Production build
npm run lint          # ESLint
```

### Environment Variables

After `npx supabase start`, copy the Project URL and anon key into `miro-poc/.env`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable key from supabase status>
```

### Verifying the Setup

Quick one-liner to confirm DB and realtime are working (requires psql):
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT (SELECT count(*) FROM boards) as board_exists, (SELECT count(*) FROM pg_publication_tables WHERE tablename = 'yjs_updates') as realtime_enabled;"
```
Expected: `board_exists = 1`, `realtime_enabled = 1`.

Note: `npx supabase db query` is not available in CLI v2.75; use `psql` directly for ad-hoc queries.

## Development Conventions

- **Commits:** Prefer atomic commits of working code. Each commit should be a self-contained, functioning change. Before committing, verify changes work by running `npm run build` and `npm run lint` from the `miro-poc/` directory. If database schema was changed, also verify with `psql` that migrations apply cleanly.
- **State Management:** Yjs CRDTs — schemaless `Y.Map` for sticky note properties (`x`, `y`, `color`), `Y.Text` for content.
- **Styling:** Tailwind CSS utility classes.
- **Environment Variables:** `VITE_`-prefixed for Vite exposure to client code.
- **Future Architecture (Meta-Model):** Transition to strict schema validation (Zod), factory render pattern for generic canvas elements, and graph operations for entity relations (grouping, framing). See `02_META_MODEL.md`.
