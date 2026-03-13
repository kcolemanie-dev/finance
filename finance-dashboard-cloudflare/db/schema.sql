-- Optional D1 schema for version 2 of the app.
CREATE TABLE IF NOT EXISTS balance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_date TEXT NOT NULL,
  total REAL NOT NULL,
  liquid REAL NOT NULL,
  invested REAL NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashflow_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT,
  category TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund TEXT NOT NULL,
  units REAL NOT NULL,
  cost_base REAL NOT NULL DEFAULT 0,
  current_price REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS etf_lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund TEXT NOT NULL,
  buy_date TEXT NOT NULL,
  units REAL NOT NULL,
  cost REAL NOT NULL,
  deemed_disposal_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
