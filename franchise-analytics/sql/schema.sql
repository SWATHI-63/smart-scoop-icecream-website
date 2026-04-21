CREATE TABLE IF NOT EXISTS franchises (
  id SERIAL PRIMARY KEY,
  franchise_name VARCHAR(120) NOT NULL,
  city VARCHAR(100) NOT NULL,
  opening_date DATE NOT NULL,
  initial_investment NUMERIC(12, 2) NOT NULL CHECK (initial_investment >= 0),
  rent_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (rent_cost >= 0),
  local_population INTEGER NOT NULL DEFAULT 0 CHECK (local_population >= 0),
  avg_income NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (avg_income >= 0),
  foot_traffic INTEGER NOT NULL DEFAULT 0 CHECK (foot_traffic >= 0),
  competitor_count INTEGER NOT NULL DEFAULT 0 CHECK (competitor_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id BIGSERIAL PRIMARY KEY,
  franchise_id INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  customer_count INTEGER NOT NULL DEFAULT 0 CHECK (customer_count >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_franchise_date
  ON sales_transactions (franchise_id, transaction_date);

CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  franchise_id INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_franchise_date
  ON expenses (franchise_id, expense_date);

CREATE TABLE IF NOT EXISTS analytics_metrics (
  id BIGSERIAL PRIMARY KEY,
  franchise_id INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
  metric_month DATE NOT NULL,
  monthly_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
  monthly_customers INTEGER NOT NULL DEFAULT 0,
  roi NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (franchise_id, metric_month)
);

CREATE INDEX IF NOT EXISTS idx_analytics_franchise_month
  ON analytics_metrics (franchise_id, metric_month DESC);
