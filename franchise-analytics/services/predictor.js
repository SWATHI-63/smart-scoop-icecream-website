import MLR from "ml-regression-multivariate-linear";
import { query } from "../db.js";

const DEFAULT_CANDIDATES = [
  {
    city: "Pune",
    population: 7400000,
    averageIncome: 54000,
    footTraffic: 16500,
    rentCost: 145000,
    competitorCount: 7,
  },
  {
    city: "Indore",
    population: 3300000,
    averageIncome: 46000,
    footTraffic: 12200,
    rentCost: 90000,
    competitorCount: 5,
  },
  {
    city: "Ahmedabad",
    population: 8400000,
    averageIncome: 59000,
    footTraffic: 18200,
    rentCost: 132000,
    competitorCount: 8,
  },
  {
    city: "Lucknow",
    population: 4200000,
    averageIncome: 41000,
    footTraffic: 10900,
    rentCost: 82000,
    competitorCount: 4,
  },
  {
    city: "Kochi",
    population: 2700000,
    averageIncome: 52000,
    footTraffic: 9600,
    rentCost: 78000,
    competitorCount: 3,
  },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function normalizeFeatures(input) {
  return [
    Number(input.population || 0) / 1_000_000,
    Number(input.averageIncome || 0) / 10_000,
    Number(input.footTraffic || 0) / 1_000,
    Number(input.rentCost || 0) / 10_000,
    Number(input.competitorCount || 0),
    Number(input.nearbyPerformance || 0) / 10_000,
  ];
}

function denormalizeProfit(normalizedProfit) {
  return normalizedProfit * 10_000;
}

async function getTrainingData() {
  const sql = `
    WITH latest_metrics AS (
      SELECT DISTINCT ON (franchise_id)
        franchise_id,
        monthly_profit
      FROM analytics_metrics
      ORDER BY franchise_id, metric_month DESC
    ), city_profit AS (
      SELECT
        f.city,
        AVG(m.monthly_profit) AS avg_city_profit
      FROM franchises f
      JOIN latest_metrics m ON f.id = m.franchise_id
      GROUP BY f.city
    )
    SELECT
      f.id,
      f.franchise_name,
      f.city,
      f.local_population,
      f.avg_income,
      f.foot_traffic,
      f.rent_cost,
      f.competitor_count,
      m.monthly_profit,
      COALESCE(cp.avg_city_profit, m.monthly_profit) AS nearby_performance
    FROM franchises f
    JOIN latest_metrics m ON f.id = m.franchise_id
    LEFT JOIN city_profit cp ON f.city = cp.city;
  `;

  const { rows } = await query(sql);
  return rows;
}

function calculateSuccessProbability(input, predictedProfit) {
  const profitSignal = clamp(predictedProfit / 250000, -1, 1);
  const trafficSignal = clamp(Number(input.footTraffic || 0) / 18000, 0, 1.2);
  const incomeSignal = clamp(Number(input.averageIncome || 0) / 70000, 0, 1.2);
  const rentPenalty = clamp(Number(input.rentCost || 0) / 180000, 0, 1.2);
  const competitionPenalty = clamp(Number(input.competitorCount || 0) / 12, 0, 1.2);
  const nearbySignal = clamp(Number(input.nearbyPerformance || 0) / 200000, -1, 1.2);

  const score =
    1.5 * profitSignal +
    0.9 * trafficSignal +
    0.6 * incomeSignal +
    0.8 * nearbySignal -
    0.7 * rentPenalty -
    0.7 * competitionPenalty;

  return Math.round(clamp(sigmoid(score) * 100, 1, 99));
}

function trainRegressionModel(trainingRows) {
  if (!trainingRows || trainingRows.length < 2) {
    return null;
  }

  const x = trainingRows.map((row) =>
    normalizeFeatures({
      population: row.local_population,
      averageIncome: row.avg_income,
      footTraffic: row.foot_traffic,
      rentCost: row.rent_cost,
      competitorCount: row.competitor_count,
      nearbyPerformance: row.nearby_performance,
    }),
  );

  const y = trainingRows.map((row) => [Number(row.monthly_profit) / 10_000]);

  return new MLR(x, y);
}

function baselinePrediction(input, trainingRows) {
  const averageProfit =
    trainingRows.reduce((sum, row) => sum + Number(row.monthly_profit), 0) /
    trainingRows.length;

  const trafficFactor = Number(input.footTraffic || 0) / 14000;
  const rentFactor = Number(input.rentCost || 0) / 120000;
  const incomeFactor = Number(input.averageIncome || 0) / 50000;
  const competitorPenalty = Number(input.competitorCount || 0) * 0.06;
  const nearbyFactor = Number(input.nearbyPerformance || averageProfit) / 120000;

  const weighted =
    averageProfit *
    (0.55 + 0.2 * trafficFactor + 0.14 * incomeFactor + 0.11 * nearbyFactor - competitorPenalty - 0.08 * rentFactor);

  return Math.max(weighted, 10000);
}

function asCurrency(number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(number);
}

export async function predictExpansion(candidates = []) {
  const trainingRows = await getTrainingData();

  if (!trainingRows.length) {
    throw new Error("No franchise data available for prediction.");
  }

  const model = trainRegressionModel(trainingRows);
  const averageNearbyPerformance =
    trainingRows.reduce((sum, row) => sum + Number(row.monthly_profit), 0) /
    trainingRows.length;

  const predictionCandidates =
    candidates.length > 0 ? candidates : DEFAULT_CANDIDATES;

  const predictions = predictionCandidates.map((candidate) => {
    const candidateWithNearby = {
      ...candidate,
      nearbyPerformance:
        candidate.nearbyPerformance ?? averageNearbyPerformance,
    };

    let predictedProfit;

    if (model) {
      const prediction = model.predict(normalizeFeatures(candidateWithNearby));
      predictedProfit = denormalizeProfit(Array.isArray(prediction) ? prediction[0] : prediction);
    } else {
      predictedProfit = baselinePrediction(candidateWithNearby, trainingRows);
    }

    predictedProfit = Math.round(Math.max(predictedProfit, 10000));

    const successProbability = calculateSuccessProbability(
      candidateWithNearby,
      predictedProfit,
    );

    return {
      city: candidate.city,
      predictedMonthlyProfit: predictedProfit,
      successProbability,
      recommendation: `Opening a franchise in ${candidate.city} has an estimated success probability of ${successProbability}% with expected monthly profit of ${asCurrency(predictedProfit)}.`,
      factors: {
        population: Number(candidate.population || 0),
        averageIncome: Number(candidate.averageIncome || 0),
        footTraffic: Number(candidate.footTraffic || 0),
        rentCost: Number(candidate.rentCost || 0),
        competitorCount: Number(candidate.competitorCount || 0),
        nearbyPerformance: Number(candidateWithNearby.nearbyPerformance || 0),
      },
    };
  });

  return predictions.sort((a, b) => b.successProbability - a.successProbability);
}

export async function getTopExpansionRecommendations(limit = 3) {
  const all = await predictExpansion();
  return all.slice(0, limit);
}
