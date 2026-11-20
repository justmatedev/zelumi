-- Run only against the dedicated demonstration database after shared migrations.
CREATE TABLE IF NOT EXISTS demo_visitors (
  owner TEXT PRIMARY KEY REFERENCES web_users(owner),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS demo_visitors_expiry ON demo_visitors(expires_at);
INSERT OR IGNORE INTO cloud_meta(key,value) VALUES('bot_id','999001');
INSERT OR IGNORE INTO cloud_meta(key,value)
  SELECT 'public_demo','1' WHERE EXISTS(SELECT 1 FROM cloud_meta WHERE key='bot_id' AND value='999001');
