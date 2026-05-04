-- db/init_lotto.sql
-- Create the lotto database if it does not exist (idempotent)
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'lotto') THEN
      PERFORM dblink_exec('dbname=' || current_database(), 'CREATE DATABASE lotto');
   END IF;
END$$;
