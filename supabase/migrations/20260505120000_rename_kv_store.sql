-- Renames a legacy public.kv_store_<hex> table to kv_store when present (run once).
DO $$
DECLARE
  legacy text;
BEGIN
  SELECT c.relname INTO legacy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname ~ '^kv_store_[0-9a-f]{8}$'
  ORDER BY c.relname
  LIMIT 1;

  IF legacy IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_class c2
    JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
    WHERE n2.nspname = 'public' AND c2.relname = 'kv_store'
  ) THEN
    EXECUTE format('ALTER TABLE %I.%I RENAME TO kv_store', 'public', legacy);
  END IF;
END $$;
