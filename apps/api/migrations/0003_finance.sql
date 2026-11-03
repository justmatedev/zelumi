CREATE TABLE IF NOT EXISTS finance_projection(owner TEXT NOT NULL,record_id TEXT NOT NULL,source_version TEXT NOT NULL,search_name TEXT NOT NULL,schedule_json TEXT NOT NULL,first_month TEXT NOT NULL,last_month TEXT NOT NULL,PRIMARY KEY(owner,record_id));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_projection_month ON finance_projection(owner,first_month,last_month);
-- statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_update AFTER UPDATE OF body,id,owner ON cloud_records BEGIN DELETE FROM finance_projection WHERE owner=OLD.owner AND record_id=CAST(OLD.id AS TEXT); END;
-- statement-breakpoint
CREATE TRIGGER IF NOT EXISTS finance_delete AFTER DELETE ON cloud_records BEGIN DELETE FROM finance_projection WHERE owner=OLD.owner AND record_id=CAST(OLD.id AS TEXT); END;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS finance_operations(owner TEXT NOT NULL,operation_key TEXT NOT NULL,request_hash TEXT NOT NULL,attempt_id TEXT NOT NULL UNIQUE,record_id TEXT NOT NULL,kind TEXT NOT NULL,response_json TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(owner,operation_key));
-- statement-breakpoint
CREATE INDEX IF NOT EXISTS finance_operations_expiry ON finance_operations(expires_at);
