-- Migration: trigger to resequence after deletes

-- Create statement-level trigger function that calls resequence_songs()
CREATE OR REPLACE FUNCTION songs_after_delete_statement_trigger()
RETURNS trigger AS $$
BEGIN
  -- call the resequence function (best-effort)
  PERFORM resequence_songs();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger to fire once per DELETE statement on songs
DROP TRIGGER IF EXISTS trg_resequence_after_delete ON songs;
CREATE TRIGGER trg_resequence_after_delete
AFTER DELETE ON songs
FOR EACH STATEMENT
EXECUTE FUNCTION songs_after_delete_statement_trigger();
