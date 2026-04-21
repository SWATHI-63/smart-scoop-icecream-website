# Franchise Profit & Loss Analysis + Expansion Prediction Module

This module adds a full business analytics stack for multi-franchise operations with:

- Multi-franchise dashboard (10+ branches)
- PostgreSQL data storage with separate tables
- Profit and loss automation
- Chart.js visual analytics
- ML-based expansion prediction and recommendations
- Admin panel for data updates

## Tech Stack

- Frontend: React (browser runtime) + Chart.js
- Backend: Node.js + Express
- Database: PostgreSQL
- AI Model: Regression (`ml-regression-multivariate-linear`)

## Database Tables

Implemented tables in [sql/schema.sql](sql/schema.sql):

- `franchises`
- `sales_transactions`
- `expenses`
- `analytics_metrics`

## Setup

1. Install dependencies:

```bash
cd franchise-analytics
npm install
```

2. Configure environment:

```bash
copy .env.example .env
```

Update `DATABASE_URL` in `.env`.

3. Start PostgreSQL:

Option A (recommended): run with Docker:

```bash
npm run db:docker:up
```

Option B: use your existing local PostgreSQL instance.

4. Create schema and seed data:

```bash
npm run db:setup
```

5. Start server:

```bash
npm run dev
```

6. Open dashboard:


- http://localhost:4000

7. (Optional) Stop Docker database:

```bash
npm run db:docker:down
```

## API Highlights

- `GET /api/franchises/dashboard` -> branch metrics with revenue, expenses, profit, ROI
- `GET /api/analytics/overview` -> total income, expenses, net profit, yearly performance
- `GET /api/analytics/charts` -> chart-ready datasets
- `POST /api/franchises` -> add new franchise
- `POST /api/franchises/:id/sales` -> add sales + recompute analytics
- `POST /api/franchises/:id/expenses` -> add expense + recompute analytics
- `GET /api/expansion/recommendations` -> ranked location recommendations
- `POST /api/expansion/predict` -> predict for custom candidate locations

## Prediction Output Example

The recommendation engine returns suggestions like:

> Opening a franchise in Pune has an estimated success probability of 82% with expected monthly profit of INR 150,000.

