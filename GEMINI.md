# Project Overview

This repository contains a Proof of Concept (POC) for a collaborative whiteboard application, inspired by tools like Miro. It demonstrates real-time synchronization of sticky note positions, text content, and user cursors.

The application is built using:
- **Frontend:** React, Vite, Tailwind CSS (v3)
- **Backend/Realtime:** Supabase (Postgres + Realtime)
- **CRDT (Conflict-free Replicated Data Type):** Yjs
- **Yjs Provider:** `y-supabase`

The architecture relies on a "Unified Yjs" approach where both the spatial coordinates (X/Y) of elements and their text content are stored within a Yjs document. The `y-supabase` provider broadcasts these CRDT updates via Supabase Realtime for instant sharing, while periodically persisting the binary document state to a Postgres table.

There are also conceptual documents (`01_CONCEPT.md` and `02_META_MODEL.md`) that outline the current architecture and future plans to move towards a strict Meta-Model to enforce schemas and entity relations on the canvas.

## Building and Running

The project relies on a local Supabase environment orchestrated by Docker via the Supabase CLI. 

### Local Supabase Setup
Start the local Supabase services, which automatically applies migrations and seeds the database:
```bash
cd miro-poc
npx supabase start
```

Stop the local Supabase services:
```bash
cd miro-poc
npx supabase stop
```

### Frontend Development Server
Install dependencies and run the Vite development server:
```bash
cd miro-poc
npm install
npm run dev
```

Build the application for production:
```bash
cd miro-poc
npm run build
```

## Development Conventions

- **State Management:** State is managed via Yjs CRDTs. Currently, the implementation uses a schemaless `Y.Map` for storing sticky note properties (`x`, `y`, `color`) and `Y.Text` for the content.
- **Future Architecture (Meta-Model):** The project aims to transition from the current schemaless state to a strict Meta-Model (`02_META_MODEL.md`). This will involve a validation layer (e.g., Zod), a factory render pattern for generic canvas elements, and graph operations for managing entity relations (like grouping and framing).
- **Environment Variables:** The frontend relies on `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which should be defined in `miro-poc/.env` based on the output from `npx supabase start`.
- **Styling:** Tailwind CSS is used for utility-first styling.
