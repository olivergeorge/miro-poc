# Miro-Style Collaborative Whiteboard POC

This repository contains a Proof of Concept (POC) for a collaborative whiteboard application, inspired by tools like Miro. It demonstrates real-time synchronization of sticky note positions, text content, and user cursors.

## Tech Stack
- **Frontend:** React, Vite, Tailwind CSS
- **Backend/Realtime:** Supabase (Postgres + Realtime)
- **CRDT (Conflict-free Replicated Data Type):** Yjs
- **Yjs Provider:** y-supabase

## Architecture
The application uses a "Unified Yjs" approach where both the spatial coordinates (X/Y) of elements and their text content are stored within a Yjs document. The `y-supabase` provider handles broadcasting these CRDT updates via Supabase Realtime for instant sharing, while periodically persisting the binary document state to a Postgres table.

## Getting Started

### 1. Local Supabase Setup
This project uses the Supabase CLI to run the Postgres database and Realtime services locally via Docker.

Navigate to the project directory and start the Supabase services:

```bash
cd miro-poc
npx supabase start
```

This will automatically apply the database migrations (`init_schema.sql`) and seed the default `BOARD_ID` required by the application.

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the `miro-poc` directory. The Supabase CLI will output your local API URL and anon key; update the `.env` file accordingly. (For the default local setup, it is usually `http://127.0.0.1:54321` and the generated anon key.)

```bash
cp .env.example .env
```

### 3. Start the Application
Run the Vite development server:

```bash
npm install
npm run dev
```

You can also access the local Supabase Studio dashboard at [http://127.0.0.1:54323](http://127.0.0.1:54323) to view your tables and realtime updates.
