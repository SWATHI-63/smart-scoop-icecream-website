// Health Analysis Module for Ice Cream
class HealthAnalyzer {
  constructor() {
    this.healthData = null;
    this.loadHealthData();
  }

  async loadHealthData() {
    try {
      const response = await fetch("icecream-health-data-large.json");
      this.healthData = await response.json();
    } catch (error) {
      console.error("Error loading health data:", error);
    }
  }

  // Analyze ice cream based on health condition
  analyzeForCondition(flavour, condition) {
    if (!this.healthData) {
      return { error: "Health data not loaded" };
    }

    const iceCream = this.healthData.healthData.find(
      (item) => item.flavor_name.toLowerCase() === flavour.toLowerCase(),
    );

    if (!iceCream) {
      return { error: "Ice cream not found" };
    }

    let score, recommendation;

    if (condition === "diabetes") {
      score = this.calculateDiabetesScore(iceCream);
      recommendation = this.healthData.recommendations.diabetes[score];
    } else if (condition === "cardiovascular") {
      score = this.calculateCardiovascularScore(iceCream);
      recommendation = this.healthData.recommendations.cardiovascular[score];
    } else if (condition === "allergy") {
      // allergens is a string, split by comma and trim
      const allergensArr = iceCream.allergens
        ? iceCream.allergens.split(",").map((a) => a.trim())
        : [];
      return {
        allergens: allergensArr,
        recommendation:
          allergensArr.length === 0
            ? "No common allergens detected!"
            : `Contains: ${allergensArr.join(", ")}`,
      };
    }

    return {
      flavour: iceCream.flavor_name,
      score: score,
      recommendation: recommendation,
      nutritionalInfo: {
        calories: iceCream.calories_per_serving,
        fat: iceCream.fat_g_per_serving,
        sugar: iceCream.sugar_g_per_serving,
        // carbs and protein not present in new dataset
      },
      details: iceCream,
    };
  }

  calculateDiabetesScore(iceCream) {
    const thresholds = this.healthData.healthThresholds.diabetes;
    const sugar = iceCream.sugar_g_per_serving;
    // carbs not present, so only use sugar
    if (sugar <= thresholds.sugar_g.excellent) {
      return "excellent";
    } else if (sugar <= thresholds.sugar_g.good) {
      return "good";
    } else if (sugar <= thresholds.sugar_g.moderate) {
      return "moderate";
    } else {
      return "poor";
    }
  }

  calculateCardiovascularScore(iceCream) {
    const thresholds = this.healthData.healthThresholds.cardiovascular;
    const fat = iceCream.fat_g_per_serving;
    const calories = iceCream.calories_per_serving;
    if (
      fat <= thresholds.fat_g.excellent &&
      calories <= thresholds.calories.excellent
    ) {
      return "excellent";
    } else if (
      fat <= thresholds.fat_g.good &&
      calories <= thresholds.calories.good
    ) {
      return "good";
    } else if (
      fat <= thresholds.fat_g.moderate &&
      calories <= thresholds.calories.moderate
    ) {
      return "moderate";
    } else {
      return "poor";
    }
  }

  // Get all safe options for a specific allergy
  getSafeOptions(allergen) {
    if (!this.healthData) return [];
    return this.healthData.healthData.filter((item) => {
      const allergensArr = item.allergens ? item.allergens.toLowerCase() : "";
      return !allergensArr.includes(allergen.toLowerCase());
    });
  }

  // Get top recommendations for a health condition
  getTopRecommendations(condition, limit = 5) {
    if (!this.healthData) return [];
    let sorted = [...this.healthData.healthData];
    if (condition === "diabetes") {
      sorted.sort((a, b) => a.sugar_g_per_serving - b.sugar_g_per_serving);
    } else if (condition === "cardiovascular") {
      sorted.sort((a, b) => a.fat_g_per_serving - b.fat_g_per_serving);
    } else if (condition === "lowcalorie" || condition === "low-calorie") {
      sorted.sort((a, b) => a.calories_per_serving - b.calories_per_serving);
    }
    return sorted.slice(0, limit);
  }

  // Check multiple allergens at once
  checkMultipleAllergens(allergens) {
    if (!this.healthData) return [];
    const allergenList = allergens.map((a) => a.toLowerCase());
    return this.healthData.healthData.filter((item) => {
      const itemAllergens = item.allergens ? item.allergens.toLowerCase() : "";
      return !allergenList.some((allergen) => itemAllergens.includes(allergen));
    });
  }

  // New: Lookup by flavor name (exact or partial)
  lookupByFlavorName(query) {
    if (!this.healthData) return [];
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.healthData.healthData.filter((item) =>
      item.flavor_name.toLowerCase().includes(q),
    );
  }
}

// Initialize the analyzer
const healthAnalyzer = new HealthAnalyzer();

// Function to display health analysis results
function displayHealthAnalysis(flavour, condition) {
  const result = healthAnalyzer.analyzeForCondition(flavour, condition);

  if (result.error) {
    return `<p class="error">${result.error}</p>`;
  }

  if (condition === "allergy") {
    return `
            <div class="health-result ${result.allergens.length === 0 ? "safe" : "warning"}">
                <h4>${flavour}</h4>
                <p>${result.recommendation}</p>
            </div>
        `;
  }

  const scoreClass = result.score;
  return `
        <div class="health-result ${scoreClass}">
            <h4>${flavour}</h4>
            <p class="score-badge ${scoreClass}">${result.score.toUpperCase()}</p>
            <p class="recommendation">${result.recommendation}</p>
            <div class="nutritional-summary">
                <span><strong>Calories:</strong> ${result.nutritionalInfo.calories}</span>
                <span><strong>Fat:</strong> ${result.nutritionalInfo.fat}g</span>
                <span><strong>Sugar:</strong> ${result.nutritionalInfo.sugar}g</span>
            </div>
        </div>
    `;
}

// Export for use in HTML
if (typeof module !== "undefined" && module.exports) {
  module.exports = { HealthAnalyzer, healthAnalyzer, displayHealthAnalysis };
}
