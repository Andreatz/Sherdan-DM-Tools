-- Estensioni richieste dallo schema Sherdan DM Tools.
-- Eseguito una sola volta da Postgres al primo avvio del volume dati
-- (file in /docker-entrypoint-initdb.d/ vengono ignorati su volumi gia'
-- inizializzati).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
