CREATE TABLE category_memory(owner TEXT NOT NULL,description_key TEXT NOT NULL,source TEXT NOT NULL CHECK(source IN ('manual','ai')),category TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at INTEGER NOT NULL,expires_at INTEGER,model_version TEXT,PRIMARY KEY(owner,description_key,source));
-- statement-breakpoint
CREATE INDEX category_memory_expiry ON category_memory(expires_at);
-- statement-breakpoint
CREATE TABLE category_record_meta(owner TEXT NOT NULL,record_id TEXT NOT NULL,source TEXT NOT NULL,record_version TEXT NOT NULL,PRIMARY KEY(owner,record_id));
-- statement-breakpoint
CREATE TRIGGER category_record_delete AFTER DELETE ON cloud_records BEGIN DELETE FROM category_record_meta WHERE owner=OLD.owner AND record_id=OLD.id; END;
-- statement-breakpoint
CREATE TABLE category_ai_budget(day_utc TEXT NOT NULL,scope TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,reservation TEXT,PRIMARY KEY(day_utc,scope));
-- statement-breakpoint
CREATE TABLE category_ai_state(key TEXT PRIMARY KEY,blocked_until INTEGER NOT NULL,reason TEXT NOT NULL);
