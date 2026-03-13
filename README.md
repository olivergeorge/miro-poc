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

### 1. Supabase Setup
Run the following SQL in your Supabase SQL Editor to set up the necessary tables and enable real-time subscriptions:

```sql
-- Create a table for the whiteboards
CREATE TABLE boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Untitled Board',
  created_at timestamptz DEFAULT now()
);

-- Create a table specifically formatted for y-supabase to store CRDT updates
CREATE TABLE yjs_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  document_update bytea NOT NULL, -- Stores the Yjs binary diffs
  created_at timestamptz DEFAULT now()
);

-- Enable Realtime for the yjs_updates table
ALTER PUBLICATION supabase_realtime ADD TABLE yjs_updates;
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the `miro-poc` directory and add your Supabase project URL and anon key:

```bash
cd miro-poc
cp .env.example .env
```

### 3. Start the Application
Create a new board in your Supabase `boards` table, copy its UUID, and replace the `BOARD_ID` constant in `src/App.jsx`.

Then run the development server:

```bash
npm install
npm run dev
```
