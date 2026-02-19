// Health Analysis Module for Ice Cream
class HealthAnalyzer {
    constructor() {
        this.healthData = null;
        this.loadHealthData();
    }

    async loadHealthData() {
        try {
            const response = await fetch('icecream-health-data.json');
            this.healthData = await response.json();
        } catch (error) {
            console.error('Error loading health data:', error);
        }
    }

    // Analyze ice cream based on health condition
    analyzeForCondition(flavour, condition) {
        if (!this.healthData) {
            return { error: 'Health data not loaded' };
        }

        const iceCream = this.healthData.healthData.find(
            item => item.flavour.toLowerCase() === flavour.toLowerCase()
        );

        if (!iceCream) {
            return { error: 'Ice cream not found' };
        }

        let score, recommendation;

        if (condition === 'diabetes') {
            score = this.calculateDiabetesScore(iceCream);
            recommendation = this.healthData.recommendations.diabetes[score];
        } else if (condition === 'cardiovascular') {
            score = this.calculateCardiovascularScore(iceCream);
            recommendation = this.healthData.recommendations.cardiovascular[score];
        } else if (condition === 'allergy') {
            return {
                allergens: iceCream.allergens,
                recommendation: iceCream.allergens.length === 0 
                    ? 'No common allergens detected!' 
                    : `Contains: ${iceCream.allergens.join(', ')}`
            };
        }

        return {
            flavour: iceCream.flavour,
            score: score,
            recommendation: recommendation,
            nutritionalInfo: {
                calories: iceCream.calories,
                fat: iceCream.fat_g,
                carbs: iceCream.carb_g,
                sugar: iceCream.sugar_g,
                protein: iceCream.protein_g
            }
        };
    }

    calculateDiabetesScore(iceCream) {
        const thresholds = this.healthData.healthThresholds.diabetes;
        const sugar = iceCream.sugar_g;
        const carbs = iceCream.carb_g;

        if (sugar <= thresholds.sugar_g.excellent && carbs <= thresholds.carb_g.excellent) {
            return 'excellent';
        } else if (sugar <= thresholds.sugar_g.good && carbs <= thresholds.carb_g.good) {
            return 'good';
        } else if (sugar <= thresholds.sugar_g.moderate && carbs <= thresholds.carb_g.moderate) {
            return 'moderate';
        } else {
            return 'poor';
        }
    }

    calculateCardiovascularScore(iceCream) {
        const thresholds = this.healthData.healthThresholds.cardiovascular;
        const fat = iceCream.fat_g;
        const calories = iceCream.calories;

        if (fat <= thresholds.fat_g.excellent && calories <= thresholds.calories.excellent) {
            return 'excellent';
        } else if (fat <= thresholds.fat_g.good && calories <= thresholds.calories.good) {
            return 'good';
        } else if (fat <= thresholds.fat_g.moderate && calories <= thresholds.calories.moderate) {
            return 'moderate';
        } else {
            return 'poor';
        }
    }

    // Get all safe options for a specific allergy
    getSafeOptions(allergen) {
        if (!this.healthData) return [];
        
        return this.healthData.healthData.filter(item => 
            !item.allergens.includes(allergen.toLowerCase())
        );
    }

    // Get top recommendations for a health condition
    getTopRecommendations(condition, limit = 5) {
        if (!this.healthData) return [];

        let sorted = [...this.healthData.healthData];

        if (condition === 'diabetes') {
            sorted.sort((a, b) => (a.sugar_g + a.carb_g) - (b.sugar_g + b.carb_g));
        } else if (condition === 'cardiovascular') {
            sorted.sort((a, b) => (a.fat_g + a.calories/10) - (b.fat_g + b.calories/10));
        } else if (condition === 'low-calorie') {
            sorted.sort((a, b) => a.calories - b.calories);
        }

        return sorted.slice(0, limit);
    }

    // Check multiple allergens at once
    checkMultipleAllergens(allergens) {
        if (!this.healthData) return [];
        
        const allergenList = allergens.map(a => a.toLowerCase());
        
        return this.healthData.healthData.filter(item => {
            return !item.allergens.some(allergen => 
                allergenList.includes(allergen.toLowerCase())
            );
        });
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

    if (condition === 'allergy') {
        return `
            <div class="health-result ${result.allergens.length === 0 ? 'safe' : 'warning'}">
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
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HealthAnalyzer, healthAnalyzer, displayHealthAnalysis };
}
