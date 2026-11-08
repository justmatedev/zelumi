CREATE TABLE category_terms(owner TEXT NOT NULL,phrase_key TEXT NOT NULL,category TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,PRIMARY KEY(owner,phrase_key));
