const { useEffect, useMemo, useRef, useState } = React;

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

async function apiRequest(path, options = {}) {
  const apiBase = window.__FRANCHISE_API_BASE__ || "";
  const apiUrl = apiBase ? `${apiBase}${path}` : path;
  const response = await fetch(apiUrl, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    const text = await response.text();
    throw new Error(`Unexpected response from API: ${text.slice(0, 80)}`);
  }

  if (!response.ok) {
    throw new Error(body.detail || body.message || "Request failed");
  }

  return body;
}

function KpiCard({ title, value }) {
  return (
    <article className="kpi-card">
      <h3>{title}</h3>
      <p>{value}</p>
    </article>
  );
}

function TrendPill({ value }) {
  const numericValue = Number(value || 0);
  let variant = "warning";
  if (numericValue >= 10) variant = "success";
  if (numericValue < 5) variant = "danger";

  return <span className={`pill ${variant}`}>{numericValue.toFixed(2)}%</span>;
}

function ChartCard({ title, type, data, options }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 12, usePointStyle: true },
          },
        },
        ...options,
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [type, data, options]);

  return (
    <article className="panel chart-card">
      <h2>{title}</h2>
      <canvas ref={canvasRef}></canvas>
    </article>
  );
}

function App() {
  const [dashboard, setDashboard] = useState([]);
  const [overview, setOverview] = useState({
    totals: {
      totalIncome: 0,
      totalExpenses: 0,
      netProfit: 0,
      totalCustomers: 0,
    },
    yearlyPerformance: [],
  });
  const [charts, setCharts] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newFranchise, setNewFranchise] = useState({
    franchiseName: "",
    city: "",
    openingDate: "",
    initialInvestment: "",
    rentCost: "",
    localPopulation: "",
    averageIncome: "",
    footTraffic: "",
    competitorCount: "",
  });

  const [salesInput, setSalesInput] = useState({
    franchiseId: "",
    transactionDate: "",
    amount: "",
    customerCount: "",
  });

  const [expenseInput, setExpenseInput] = useState({
    franchiseId: "",
    expenseDate: "",
    category: "Operations",
    amount: "",
  });

  const [predictionInput, setPredictionInput] = useState({
    city: "",
    population: "",
    averageIncome: "",
    footTraffic: "",
    rentCost: "",
    competitorCount: "",
    nearbyPerformance: "",
  });

  const [manualPrediction, setManualPrediction] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardRes, overviewRes, chartsRes, recommendationRes] =
        await Promise.all([
          apiRequest("/api/franchises/dashboard"),
          apiRequest("/api/analytics/overview"),
          apiRequest("/api/analytics/charts"),
          apiRequest("/api/expansion/recommendations"),
        ]);

      setDashboard(dashboardRes);
      setOverview(overviewRes);
      setCharts(chartsRes);
      setRecommendations(recommendationRes);
      if (!salesInput.franchiseId && dashboardRes.length) {
        setSalesInput((prev) => ({
          ...prev,
          franchiseId: String(dashboardRes[0].id),
        }));
        setExpenseInput((prev) => ({
          ...prev,
          franchiseId: String(dashboardRes[0].id),
        }));
      }
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const kpis = useMemo(
    () => [
      {
        title: "Total Monthly Income",
        value: formatCurrency(overview.totals.totalIncome),
      },
      {
        title: "Total Monthly Expenses",
        value: formatCurrency(overview.totals.totalExpenses),
      },
      {
        title: "Net Monthly Profit",
        value: formatCurrency(overview.totals.netProfit),
      },
      {
        title: "Monthly Customers",
        value: formatNumber(overview.totals.totalCustomers),
      },
    ],
    [overview],
  );

  const chartData = useMemo(() => {
    if (!charts) return null;

    return {
      profitVsExpense: {
        labels: charts.profitVsExpense.map((item) => item.franchise),
        datasets: [
          {
            label: "Revenue",
            data: charts.profitVsExpense.map((item) => item.revenue),
            backgroundColor: "#6aa6ff",
          },
          {
            label: "Expenses",
            data: charts.profitVsExpense.map((item) => item.expenses),
            backgroundColor: "#ff8b8b",
          },
          {
            label: "Profit",
            data: charts.profitVsExpense.map((item) => item.profit),
            backgroundColor: "#2ec893",
          },
        ],
      },
      monthlyPerformance: {
        labels: charts.monthlyPerformance.map((item) => item.month),
        datasets: [
          {
            label: "Revenue",
            data: charts.monthlyPerformance.map((item) => item.revenue),
            borderColor: "#2c7df7",
            backgroundColor: "rgba(44, 125, 247, 0.2)",
            tension: 0.25,
          },
          {
            label: "Expenses",
            data: charts.monthlyPerformance.map((item) => item.expenses),
            borderColor: "#ef6b6b",
            backgroundColor: "rgba(239, 107, 107, 0.2)",
            tension: 0.25,
          },
          {
            label: "Profit",
            data: charts.monthlyPerformance.map((item) => item.profit),
            borderColor: "#11b980",
            backgroundColor: "rgba(17, 185, 128, 0.2)",
            tension: 0.25,
          },
        ],
      },
      franchiseComparison: {
        labels: charts.franchiseComparison.map((item) => item.franchise),
        datasets: [
          {
            label: "Monthly Profit",
            data: charts.franchiseComparison.map((item) => item.monthlyProfit),
            borderRadius: 8,
            backgroundColor: [
              "#2d7cf7",
              "#4aa6ff",
              "#39c2a5",
              "#00b89f",
              "#4f5cf1",
              "#6c48d9",
              "#8c5af7",
              "#38bdf8",
              "#22c55e",
              "#f59e0b",
            ],
          },
        ],
      },
      roiAnalysis: {
        labels: charts.roiAnalysis.map((item) => item.franchise),
        datasets: [
          {
            label: "ROI %",
            data: charts.roiAnalysis.map((item) => item.roi),
            borderColor: "#5b6ef8",
            backgroundColor: "rgba(91, 110, 248, 0.22)",
            fill: true,
          },
        ],
      },
    };
  }, [charts]);

  const resetMessage = () => {
    setError("");
    setSuccess("");
  };

  const onNewFranchiseSubmit = async (event) => {
    event.preventDefault();
    resetMessage();

    try {
      await apiRequest("/api/franchises", {
        method: "POST",
        body: JSON.stringify(newFranchise),
      });
      setSuccess("New franchise added successfully.");
      setNewFranchise({
        franchiseName: "",
        city: "",
        openingDate: "",
        initialInvestment: "",
        rentCost: "",
        localPopulation: "",
        averageIncome: "",
        footTraffic: "",
        competitorCount: "",
      });
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    }
  };

  const onSalesSubmit = async (event) => {
    event.preventDefault();
    resetMessage();

    try {
      await apiRequest(`/api/franchises/${salesInput.franchiseId}/sales`, {
        method: "POST",
        body: JSON.stringify(salesInput),
      });
      setSuccess("Sales data updated and analytics recalculated.");
      setSalesInput((prev) => ({
        ...prev,
        transactionDate: "",
        amount: "",
        customerCount: "",
      }));
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    }
  };

  const onExpenseSubmit = async (event) => {
    event.preventDefault();
    resetMessage();

    try {
      await apiRequest(`/api/franchises/${expenseInput.franchiseId}/expenses`, {
        method: "POST",
        body: JSON.stringify(expenseInput),
      });
      setSuccess("Expense data updated and analytics recalculated.");
      setExpenseInput((prev) => ({
        ...prev,
        expenseDate: "",
        amount: "",
      }));
      await loadData();
    } catch (apiError) {
      setError(apiError.message);
    }
  };

  const onPredictionSubmit = async (event) => {
    event.preventDefault();
    resetMessage();

    try {
      const payload = {
        candidates: [
          {
            city: predictionInput.city,
            population: Number(predictionInput.population),
            averageIncome: Number(predictionInput.averageIncome),
            footTraffic: Number(predictionInput.footTraffic),
            rentCost: Number(predictionInput.rentCost),
            competitorCount: Number(predictionInput.competitorCount),
            nearbyPerformance: predictionInput.nearbyPerformance
              ? Number(predictionInput.nearbyPerformance)
              : undefined,
          },
        ],
      };

      const response = await apiRequest("/api/expansion/predict", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setManualPrediction(response[0]);
      setSuccess("Expansion prediction generated.");
    } catch (apiError) {
      setError(apiError.message);
    }
  };

  if (loading) {
    return (
      <main className="dashboard-shell">
        <div className="panel">Loading franchise analytics dashboard...</div>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Franchise Profit and Expansion Intelligence</h1>
          <p>
            Multi-franchise P&L dashboard with ROI analytics, trend tracking,
            and AI-driven location recommendations.
          </p>
        </div>
        <button className="ghost" onClick={loadData}>
          Refresh Dashboard
        </button>
      </header>

      {error ? <div className="alert error">{error}</div> : null}
      {success ? <div className="alert success">{success}</div> : null}

      <section className="kpi-grid">
        {kpis.map((item) => (
          <KpiCard key={item.title} title={item.title} value={item.value} />
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <h2>Multi-Franchise Dashboard (10+ locations)</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Franchise</th>
                  <th>City</th>
                  <th>Opening Date</th>
                  <th>Revenue</th>
                  <th>Expenses</th>
                  <th>Profit</th>
                  <th>Customers</th>
                  <th>ROI</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.map((branch) => (
                  <tr key={branch.id}>
                    <td>{branch.franchise_name}</td>
                    <td>{branch.city}</td>
                    <td>
                      {new Date(branch.opening_date).toLocaleDateString()}
                    </td>
                    <td>{formatCurrency(branch.monthly_revenue)}</td>
                    <td>{formatCurrency(branch.monthly_expenses)}</td>
                    <td>{formatCurrency(branch.monthly_profit)}</td>
                    <td>{formatNumber(branch.monthly_customers)}</td>
                    <td>
                      <TrendPill value={branch.roi} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="panel panel-stack">
          <section>
            <h2>Add New Franchise</h2>
            <form className="form-grid" onSubmit={onNewFranchiseSubmit}>
              <label>
                Franchise Name
                <input
                  value={newFranchise.franchiseName}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      franchiseName: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                City
                <input
                  value={newFranchise.city}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Opening Date
                <input
                  type="date"
                  value={newFranchise.openingDate}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      openingDate: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Initial Investment
                <input
                  type="number"
                  value={newFranchise.initialInvestment}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      initialInvestment: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Rent Cost
                <input
                  type="number"
                  value={newFranchise.rentCost}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      rentCost: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Local Population
                <input
                  type="number"
                  value={newFranchise.localPopulation}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      localPopulation: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Average Income
                <input
                  type="number"
                  value={newFranchise.averageIncome}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      averageIncome: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Foot Traffic
                <input
                  type="number"
                  value={newFranchise.footTraffic}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      footTraffic: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Competitor Count
                <input
                  type="number"
                  value={newFranchise.competitorCount}
                  onChange={(e) =>
                    setNewFranchise((prev) => ({
                      ...prev,
                      competitorCount: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="actions-row">
                <button className="primary" type="submit">
                  Add Franchise
                </button>
              </div>
            </form>
          </section>
        </aside>
      </section>

      {chartData ? (
        <section className="chart-grid">
          <ChartCard
            title="Profit vs Expense Chart"
            type="bar"
            data={chartData.profitVsExpense}
          />
          <ChartCard
            title="Monthly Performance Graph"
            type="line"
            data={chartData.monthlyPerformance}
          />
          <ChartCard
            title="Franchise Comparison Chart"
            type="bar"
            data={chartData.franchiseComparison}
          />
          <ChartCard
            title="ROI Analysis"
            type="radar"
            data={chartData.roiAnalysis}
          />
        </section>
      ) : null}

      <section className="dashboard-grid" style={{ marginTop: "14px" }}>
        <article className="panel panel-stack">
          <section>
            <h2>Admin Panel: Update Sales</h2>
            <form className="form-grid" onSubmit={onSalesSubmit}>
              <label>
                Franchise
                <select
                  value={salesInput.franchiseId}
                  onChange={(e) =>
                    setSalesInput((prev) => ({
                      ...prev,
                      franchiseId: e.target.value,
                    }))
                  }
                  required
                >
                  {dashboard.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.franchise_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Transaction Date
                <input
                  type="date"
                  value={salesInput.transactionDate}
                  onChange={(e) =>
                    setSalesInput((prev) => ({
                      ...prev,
                      transactionDate: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Sales Amount
                <input
                  type="number"
                  value={salesInput.amount}
                  onChange={(e) =>
                    setSalesInput((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Customer Count
                <input
                  type="number"
                  value={salesInput.customerCount}
                  onChange={(e) =>
                    setSalesInput((prev) => ({
                      ...prev,
                      customerCount: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="actions-row">
                <button className="secondary" type="submit">
                  Update Sales Data
                </button>
              </div>
            </form>
          </section>

          <section>
            <h2>Admin Panel: Update Expenses</h2>
            <form className="form-grid" onSubmit={onExpenseSubmit}>
              <label>
                Franchise
                <select
                  value={expenseInput.franchiseId}
                  onChange={(e) =>
                    setExpenseInput((prev) => ({
                      ...prev,
                      franchiseId: e.target.value,
                    }))
                  }
                  required
                >
                  {dashboard.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.franchise_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Expense Date
                <input
                  type="date"
                  value={expenseInput.expenseDate}
                  onChange={(e) =>
                    setExpenseInput((prev) => ({
                      ...prev,
                      expenseDate: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Category
                <input
                  value={expenseInput.category}
                  onChange={(e) =>
                    setExpenseInput((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Expense Amount
                <input
                  type="number"
                  value={expenseInput.amount}
                  onChange={(e) =>
                    setExpenseInput((prev) => ({
                      ...prev,
                      amount: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <div className="actions-row">
                <button className="primary" type="submit">
                  Update Expense Data
                </button>
              </div>
            </form>
          </section>
        </article>

        <aside className="panel panel-stack">
          <section>
            <h2>Smart Expansion Prediction</h2>
            <form className="form-grid" onSubmit={onPredictionSubmit}>
              <label>
                Candidate City
                <input
                  value={predictionInput.city}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Population
                <input
                  type="number"
                  value={predictionInput.population}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      population: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Average Income
                <input
                  type="number"
                  value={predictionInput.averageIncome}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      averageIncome: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Foot Traffic
                <input
                  type="number"
                  value={predictionInput.footTraffic}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      footTraffic: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Rent Cost
                <input
                  type="number"
                  value={predictionInput.rentCost}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      rentCost: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Competitor Count
                <input
                  type="number"
                  value={predictionInput.competitorCount}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      competitorCount: e.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                Nearby Franchise Performance
                <input
                  type="number"
                  value={predictionInput.nearbyPerformance}
                  onChange={(e) =>
                    setPredictionInput((prev) => ({
                      ...prev,
                      nearbyPerformance: e.target.value,
                    }))
                  }
                  placeholder="Optional"
                />
              </label>
              <div className="actions-row">
                <button className="secondary" type="submit">
                  Predict Location Success
                </button>
              </div>
            </form>

            {manualPrediction ? (
              <div
                className="recommendation-item"
                style={{ marginTop: "12px" }}
              >
                <h4>{manualPrediction.city}</h4>
                <p>{manualPrediction.recommendation}</p>
              </div>
            ) : null}
          </section>

          <section>
            <h2>Recommended New Locations</h2>
            <div className="recommendation-list">
              {recommendations.map((item) => (
                <article className="recommendation-item" key={item.city}>
                  <h4>{item.city}</h4>
                  <p>{item.recommendation}</p>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2>Yearly Performance</h2>
            <div className="table-wrap" style={{ maxHeight: "170px" }}>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Total Income</th>
                    <th>Total Expenses</th>
                    <th>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.yearlyPerformance.map((yearData) => (
                    <tr key={yearData.year}>
                      <td>{yearData.year}</td>
                      <td>{formatCurrency(yearData.total_income)}</td>
                      <td>{formatCurrency(yearData.total_expenses)}</td>
                      <td>{formatCurrency(yearData.net_profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
