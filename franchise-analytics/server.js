import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { query, verifyConnection, withTransaction } from "./db.js";
import {
  getChartsData,
  getDashboardData,
  getFranchiseById,
  getMonthlyPerformance,
  getOverviewData,
  upsertMetricForMonth,
} from "./services/analytics.js";
import {
  getTopExpansionRecommendations,
  predictExpansion,
} from "./services/predictor.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/franchises", async (_req, res, next) => {
  try {
    const franchises = await getDashboardData();
    res.json(franchises);
  } catch (error) {
    next(error);
  }
});

app.get("/api/franchises/dashboard", async (_req, res, next) => {
  try {
    const dashboard = await getDashboardData();
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

app.post("/api/franchises", async (req, res, next) => {
  try {
    const {
      franchiseName,
      city,
      openingDate,
      initialInvestment,
      rentCost,
      localPopulation,
      averageIncome,
      footTraffic,
      competitorCount,
    } = req.body;

    if (!franchiseName || !city || !openingDate || !initialInvestment) {
      return res.status(400).json({
        message:
          "franchiseName, city, openingDate and initialInvestment are required.",
      });
    }

    const insertSql = `
      INSERT INTO franchises (
        franchise_name,
        city,
        opening_date,
        initial_investment,
        rent_cost,
        local_population,
        avg_income,
        foot_traffic,
        competitor_count
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;

    const { rows } = await query(insertSql, [
      franchiseName,
      city,
      openingDate,
      Number(initialInvestment),
      Number(rentCost || 0),
      Number(localPopulation || 0),
      Number(averageIncome || 0),
      Number(footTraffic || 0),
      Number(competitorCount || 0),
    ]);

    res.status(201).json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/franchises/:id", async (req, res, next) => {
  try {
    const franchiseId = Number(req.params.id);

    const {
      franchiseName,
      city,
      openingDate,
      initialInvestment,
      rentCost,
      localPopulation,
      averageIncome,
      footTraffic,
      competitorCount,
    } = req.body;

    const updateSql = `
      UPDATE franchises
      SET
        franchise_name = COALESCE($2, franchise_name),
        city = COALESCE($3, city),
        opening_date = COALESCE($4, opening_date),
        initial_investment = COALESCE($5, initial_investment),
        rent_cost = COALESCE($6, rent_cost),
        local_population = COALESCE($7, local_population),
        avg_income = COALESCE($8, avg_income),
        foot_traffic = COALESCE($9, foot_traffic),
        competitor_count = COALESCE($10, competitor_count)
      WHERE id = $1
      RETURNING *;
    `;

    const { rows } = await query(updateSql, [
      franchiseId,
      franchiseName ?? null,
      city ?? null,
      openingDate ?? null,
      initialInvestment != null ? Number(initialInvestment) : null,
      rentCost != null ? Number(rentCost) : null,
      localPopulation != null ? Number(localPopulation) : null,
      averageIncome != null ? Number(averageIncome) : null,
      footTraffic != null ? Number(footTraffic) : null,
      competitorCount != null ? Number(competitorCount) : null,
    ]);

    if (!rows.length) {
      return res.status(404).json({ message: "Franchise not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/franchises/:id/sales", async (req, res, next) => {
  try {
    const franchiseId = Number(req.params.id);
    const { transactionDate, amount, customerCount } = req.body;

    if (!transactionDate || amount == null) {
      return res.status(400).json({
        message: "transactionDate and amount are required.",
      });
    }

    const franchise = await getFranchiseById(franchiseId);
    if (!franchise) {
      return res.status(404).json({ message: "Franchise not found" });
    }

    await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO sales_transactions (
          franchise_id,
          transaction_date,
          amount,
          customer_count
        )
        VALUES ($1, $2, $3, $4)
      `,
        [
          franchiseId,
          transactionDate,
          Number(amount),
          Number(customerCount || 0),
        ],
      );

      await upsertMetricForMonth(client, franchiseId, transactionDate);
    });

    res.status(201).json({ message: "Sales transaction added." });
  } catch (error) {
    next(error);
  }
});

app.post("/api/franchises/:id/expenses", async (req, res, next) => {
  try {
    const franchiseId = Number(req.params.id);
    const { expenseDate, category, amount } = req.body;

    if (!expenseDate || !category || amount == null) {
      return res.status(400).json({
        message: "expenseDate, category and amount are required.",
      });
    }

    const franchise = await getFranchiseById(franchiseId);
    if (!franchise) {
      return res.status(404).json({ message: "Franchise not found" });
    }

    await withTransaction(async (client) => {
      await client.query(
        `
        INSERT INTO expenses (
          franchise_id,
          expense_date,
          category,
          amount
        )
        VALUES ($1, $2, $3, $4)
      `,
        [franchiseId, expenseDate, category, Number(amount)],
      );

      await upsertMetricForMonth(client, franchiseId, expenseDate);
    });

    res.status(201).json({ message: "Expense added." });
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics/overview", async (_req, res, next) => {
  try {
    const overview = await getOverviewData();
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics/monthly-performance", async (_req, res, next) => {
  try {
    const performance = await getMonthlyPerformance();
    res.json(performance);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analytics/charts", async (_req, res, next) => {
  try {
    const charts = await getChartsData();
    res.json(charts);
  } catch (error) {
    next(error);
  }
});

app.get("/api/expansion/recommendations", async (_req, res, next) => {
  try {
    const recommendations = await getTopExpansionRecommendations(5);
    res.json(recommendations);
  } catch (error) {
    next(error);
  }
});

app.post("/api/expansion/predict", async (req, res, next) => {
  try {
    const { candidates } = req.body;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({
        message: "candidates array with at least one location is required.",
      });
    }

    const predictions = await predictExpansion(candidates);
    res.json(predictions);
  } catch (error) {
    next(error);
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: "Internal server error",
    detail: error.message,
  });
});

async function startServer() {
  try {
    await verifyConnection();
    app.listen(port, () => {
      console.log(
        `Franchise analytics module running on http://localhost:${port}`,
      );
    });
  } catch (error) {
    console.error("Unable to connect to database:", error);
    process.exit(1);
  }
}

startServer();
