PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  post_code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  topic TEXT NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  image TEXT,
  link TEXT,
  plan TEXT NOT NULL DEFAULT 'FREE',
  plan2 TEXT NOT NULL DEFAULT '7D',
  created_on TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  order_id TEXT NOT NULL UNIQUE,
  utr TEXT NOT NULL,
  gateway_order_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_on DESC);
CREATE INDEX IF NOT EXISTS idx_posts_topic ON posts(topic);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  post_code TEXT NOT NULL UNIQUE,
  post_json TEXT NOT NULL,
  gateway_order_id TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  utr TEXT,
  paid_amount INTEGER,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE,
  gateway_order_id TEXT NOT NULL,
  utr TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);
