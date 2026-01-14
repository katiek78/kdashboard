-- Migration: resequence songs to close gaps

-- Reorders songs' sequence values to be contiguous starting at 1
-- Returns the number of rows (new max sequence)
CREATE OR REPLACE FUNCTION resequence_songs()
RETURNS integer AS $$
DECLARE
  r RECORD;
  i integer := 0;
BEGIN
  FOR r IN SELECT id FROM songs ORDER BY sequence ASC, created_at ASC LOOP
    i := i + 1;
    UPDATE songs SET sequence = i WHERE id = r.id;
  END LOOP;
  RETURN i;
END;
$$ LANGUAGE plpgsql;