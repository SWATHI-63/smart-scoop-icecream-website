import { query } from "../db.js";

export async function getDashboardData() {
  const sql = `
    WITH latest_metrics AS (
      SELECT DISTINCT ON (franchise_id)
        franchise_id,
        metric_month,
        monthly_revenue,
        monthly_expenses,
        monthly_profit,
        monthly_customers,
        roi
      FROM analytics_metrics
      ORDER BY franchise_id, metric_month DESC
    )
    SELECT
      f.id,
      f.franchise_name,
      f.city,
      f.opening_date,
      f.initial_investment,
      f.rent_cost,
      f.local_population,
      f.avg_income,
      f.foot_traffic,
      f.competitor_count,
      COALESCE(m.monthly_revenue, 0) AS monthly_revenue,
      COALESCE(m.monthly_expenses, 0) AS monthly_expenses,
      COALESCE(m.monthly_profit, 0) AS monthly_profit,
      COALESCE(m.monthly_customers, 0) AS monthly_customers,
      COALESCE(m.roi,
        CASE
          WHEN f.initial_investment > 0 THEN (COALESCE(m.monthly_profit, 0) / f.initial_investment) * 100
          ELSE 0
        END
      ) AS roi,
      m.metric_month
    FROM franchises f
    LEFT JOIN latest_metrics m ON m.franchise_id = f.id
    ORDER BY f.id;
  `;

  const { rows } = await query(sql);
  return rows;
}

export async function getOverviewData() {
  const dashboard = await getDashboardData();

  const totals = dashboard.reduce(
    (acc, item) => {
      acc.totalIncome += Number(item.monthly_revenue);
      acc.totalExpenses += Number(item.monthly_expenses);
      acc.netProfit += Number(item.monthly_profit);
      acc.totalCustomers += Number(item.monthly_customers);
      return acc;
    },
    { totalIncome: 0, totalExpenses: 0, netProfit: 0, totalCustomers: 0 },
  );

  const yearlyPerformanceSql = `
    SELECT
      EXTRACT(YEAR FROM metric_month)::int AS year,
      SUM(monthly_revenue)::numeric(12,2) AS total_income,
      SUM(monthly_expenses)::numeric(12,2) AS total_expenses,
      SUM(monthly_profit)::numeric(12,2) AS net_profit
    FROM analytics_metrics
    GROUP BY EXTRACT(YEAR FROM metric_month)
    ORDER BY year DESC;
  `;

  const yearlyPerformance = await query(yearlyPerformanceSql);

  return {
    totals,
    yearlyPerformance: yearlyPerformance.rows,
  };
}

export async function getMonthlyPerformance() {
  const sql = `
    SELECT
      TO_CHAR(metric_month, 'YYYY-MM') AS month,
      SUM(monthly_revenue)::numeric(12,2) AS revenue,
      SUM(monthly_expenses)::numeric(12,2) AS expenses,
      SUM(monthly_profit)::numeric(12,2) AS profit
    FROM analytics_metrics
    WHERE metric_month >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '11 months'
    GROUP BY metric_month
    ORDER BY metric_month;
  `;

  const { rows } = await query(sql);
  return rows;
}

export async function getChartsData() {
  const dashboard = await getDashboardData();
  const monthlyPerformance = await getMonthlyPerformance();

  return {
    profitVsExpense: dashboard.map((branch) => ({
      franchise: branch.franchise_name,
      revenue: Number(branch.monthly_revenue),
      expenses: Number(branch.monthly_expenses),
      profit: Number(branch.monthly_profit),
    })),
    monthlyPerformance: monthlyPerformance.map((item) => ({
      month: item.month,
      revenue: Number(item.revenue),
      expenses: Number(item.expenses),
      profit: Number(item.profit),
    })),
    franchiseComparison: dashboard.map((branch) => ({
      franchise: branch.franchise_name,
      city: branch.city,
      monthlyProfit: Number(branch.monthly_profit),
      customers: Number(branch.monthly_customers),
    })),
    roiAnalysis: dashboard.map((branch) => ({
      franchise: branch.franchise_name,
      roi: Number(branch.roi),
    })),
  };
}

export async function upsertMetricForMonth(client, franchiseId, metricMonth) {
  const salesSql = `
    SELECT
      COALESCE(SUM(amount), 0) AS revenue,
      COALESCE(SUM(customer_count), 0) AS customers
    FROM sales_transactions
    WHERE franchise_id = $1
      AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', $2::date);
  `;

  const expenseSql = `
    SELECT COALESCE(SUM(amount), 0) AS expenses
    FROM expenses
    WHERE franchise_id = $1
      AND DATE_TRUNC('month', expense_date) = DATE_TRUNC('month', $2::date);
  `;

  const franchiseSql = `
    SELECT initial_investment, rent_cost
    FROM franchises
    WHERE id = $1;
  `;

  const salesRes = await client.query(salesSql, [franchiseId, metricMonth]);
  const expenseRes = await client.query(expenseSql, [franchiseId, metricMonth]);
  const franchiseRes = await client.query(franchiseSql, [franchiseId]);

  if (franchiseRes.rows.length === 0) {
    throw new Error("Franchise not found");
  }

  const revenue = Number(salesRes.rows[0].revenue);
  const customers = Number(salesRes.rows[0].customers);
  const variableExpenses = Number(expenseRes.rows[0].expenses);
  const rentCost = Number(franchiseRes.rows[0].rent_cost);
  const initialInvestment = Number(franchiseRes.rows[0].initial_investment);

  const monthlyExpenses = variableExpenses + rentCost;
  const monthlyProfit = revenue - monthlyExpenses;
  const roi =
    initialInvestment > 0 ? (monthlyProfit / initialInvestment) * 100 : 0;

  const upsertSql = `
    INSERT INTO analytics_metrics (
      franchise_id,
      metric_month,
      monthly_revenue,
      monthly_expenses,
      monthly_profit,
      monthly_customers,
      roi
    )
    VALUES ($1, DATE_TRUNC('month', $2::date), $3, $4, $5, $6, $7)
    ON CONFLICT (franchise_id, metric_month)
    DO UPDATE SET
      monthly_revenue = EXCLUDED.monthly_revenue,
      monthly_expenses = EXCLUDED.monthly_expenses,
      monthly_profit = EXCLUDED.monthly_profit,
      monthly_customers = EXCLUDED.monthly_customers,
      roi = EXCLUDED.roi,
      updated_at = NOW();
  `;

  await client.query(upsertSql, [
    franchiseId,
    metricMonth,
    revenue,
    monthlyExpenses,
    monthlyProfit,
    customers,
    roi,
  ]);
}

export async function getFranchiseById(franchiseId) {
  const { rows } = await query("SELECT * FROM franchises WHERE id = $1", [
    franchiseId,
  ]);
  return rows[0] || null;
}
