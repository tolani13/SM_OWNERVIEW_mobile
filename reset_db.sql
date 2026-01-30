-- Studio Maestro Database Reset Script
-- This will drop and recreate the public schema cleanly

\c studio_maestro

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO studio_user;
GRANT ALL ON SCHEMA public TO public;

\q
