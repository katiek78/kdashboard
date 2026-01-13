-- Migration: create songs and import tables

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- songs table: stores unique songs for the user
CREATE TABLE IF NOT EXISTS songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text NOT NULL,
  norm_title text NOT NULL,
  norm_artist text NOT NULL,
  first_listen_date date,
  sequence integer NOT NULL,
  curated boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Normalized unique index to help dedupe (lowercase trimmed norm fields expected from app)
CREATE UNIQUE INDEX IF NOT EXISTS songs_norm_unique_idx ON songs (norm_artist, norm_title);

-- Indexes to support queries by date and sequence
CREATE INDEX IF NOT EXISTS songs_first_listen_date_idx ON songs (first_listen_date);
CREATE INDEX IF NOT EXISTS songs_sequence_idx ON songs (sequence);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_songs_updated_at
BEFORE UPDATE ON songs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- imports table records high-level import jobs
CREATE TABLE IF NOT EXISTS imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL, -- 'sheet' | 'lastfm' | 'manual'
  user_id uuid, -- optional if you track users
  status text DEFAULT 'pending', -- pending | processing | completed | failed
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- import_rows holds each parsed row from an import for audit and matching
CREATE TABLE IF NOT EXISTS import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES imports(id) ON DELETE CASCADE,
  raw jsonb, -- original pasted row
  mapped_title text,
  mapped_artist text,
  mapped_date date,
  notes text,
  status text DEFAULT 'pending', -- pending | merged | ambiguous | error
  matched_song_id uuid REFERENCES songs(id),
  confidence numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS import_rows_import_id_idx ON import_rows (import_id);
CREATE INDEX IF NOT EXISTS import_rows_matched_song_id_idx ON import_rows (matched_song_id);

-- Trigger to update updated_at for imports and import_rows
CREATE TRIGGER trg_update_imports_updated_at
BEFORE UPDATE ON imports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_update_import_rows_updated_at
BEFORE UPDATE ON import_rows
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- helper: return current max sequence
CREATE OR REPLACE FUNCTION max_sequence()
RETURNS TABLE(max integer) AS $$
BEGIN
  RETURN QUERY SELECT max(sequence) FROM songs;
END;
$$ LANGUAGE plpgsql;
