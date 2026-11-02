CREATE TABLE cloud_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE cloud_state (owner TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 0, pending TEXT);
CREATE TABLE cloud_processed (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, attempt TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX cloud_processed_created ON cloud_processed(created_at);
CREATE TABLE cloud_records (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL, body TEXT NOT NULL,
  date TEXT GENERATED ALWAYS AS (json_extract(body,'$.date')) STORED,
  type TEXT GENERATED ALWAYS AS (json_extract(body,'$.type')) STORED,
  amount INTEGER GENERATED ALWAYS AS (json_extract(body,'$.amount')) STORED
);
CREATE INDEX cloud_records_owner_sequence ON cloud_records(owner,sequence DESC);
CREATE INDEX cloud_records_owner_date ON cloud_records(owner,date);
CREATE TABLE cloud_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT, update_id INTEGER NOT NULL, method TEXT NOT NULL, payload TEXT NOT NULL,
  next_attempt INTEGER NOT NULL DEFAULT 0, lease TEXT, lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX cloud_outbox_ready ON cloud_outbox(next_attempt,lease_until,id);
