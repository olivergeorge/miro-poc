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

-- (Optional but recommended) Row Level Security (RLS)
-- For the POC, we can allow anonymous access, but secure this later!
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE yjs_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access to boards" ON boards FOR ALL USING (true);
CREATE POLICY "Public access to yjs_updates" ON yjs_updates FOR ALL USING (true);
