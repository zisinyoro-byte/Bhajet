import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentPeriod, getPeriodKey, getPeriodForDate } from '@/lib/periods';

interface CategorySpending {
  category: string;
  totalSpent: number;
  transactionCount: number;
  avgPerPeriod: number;
  maxPerPeriod: number;
  minPerPeriod: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  periodsAnalyzed: number;
}

// Analyze spending patterns and suggest budget limits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodsToAnalyze = parseInt(searchParams.get('periods') || '6');
    
    // Get all transactions
    const transactions = await db.transaction.findMany({
      orderBy: { date: 'asc' }
    });

    // Get existing budgets for current period
    const currentPeriod = getCurrentPeriod();
    const currentPeriodKey = getPeriodKey(currentPeriod.id, currentPeriod.year);
    const existingBudgets = await db.budget.findMany({
      where: { period: currentPeriodKey }
    });

    // Group spending by period and category
    const spendingByPeriodAndCategory: Record<string, Record<string, number>> = {};
    
    transactions
      .filter(t => t.type === 'expenditure')
      .forEach(t => {
        const date = new Date(t.date);
        const periodNum = getPeriodForDate(date);
        const year = date.getFullYear();
        const periodKey = getPeriodKey(periodNum, year);
        
        if (!spendingByPeriodAndCategory[periodKey]) {
          spendingByPeriodAndCategory[periodKey] = {};
        }
        if (!spendingByPeriodAndCategory[periodKey][t.category]) {
          spendingByPeriodAndCategory[periodKey][t.category] = 0;
        }
        spendingByPeriodAndCategory[periodKey][t.category] += t.amount;
      });

    // Get recent periods (sorted)
    const recentPeriods = Object.keys(spendingByPeriodAndCategory)
      .sort((a, b) => b.localeCompare(a))
      .slice(0, periodsToAnalyze);

    // Analyze each category
    const allCategories = new Set<string>();
    recentPeriods.forEach(period => {
      Object.keys(spendingByPeriodAndCategory[period]).forEach(cat => allCategories.add(cat));
    });

    const categoryAnalysis: CategorySpending[] = [];
    
    allCategories.forEach(category => {
      const periodSpendings: number[] = [];
      
      recentPeriods.forEach(period => {
        const spent = spendingByPeriodAndCategory[period]?.[category] || 0;
        periodSpendings.push(spent);
      });

      if (periodSpendings.length === 0) return;

      const totalSpent = periodSpendings.reduce((a, b) => a + b, 0);
      const transactionCount = transactions.filter(
        t => t.type === 'expenditure' && t.category === category
      ).length;
      const avgPerPeriod = totalSpent / periodSpendings.length;
      const maxPerPeriod = Math.max(...periodSpendings);
      const minPerPeriod = Math.min(...periodSpendings);

      // Calculate trend
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (periodSpendings.length >= 3) {
        const recent = periodSpendings.slice(0, Math.floor(periodSpendings.length / 2));
        const older = periodSpendings.slice(Math.floor(periodSpendings.length / 2));
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
        
        if (olderAvg > 0) {
          const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;
          if (changePercent > 10) trend = 'increasing';
          else if (changePercent < -10) trend = 'decreasing';
        }
      }

      categoryAnalysis.push({
        category,
        totalSpent,
        transactionCount,
        avgPerPeriod,
        maxPerPeriod,
        minPerPeriod,
        trend,
        periodsAnalyzed: periodSpendings.length,
      });
    });

    // Sort by average spending
    categoryAnalysis.sort((a, b) => b.avgPerPeriod - a.avgPerPeriod);

    // Generate budget suggestions
    const suggestions = categoryAnalysis.map(cat => {
      // Suggest budget based on average + 10% buffer, but at least max * 1.05
      const baseSuggestion = cat.avgPerPeriod * 1.1;
      const maxBuffer = cat.maxPerPeriod * 1.05;
      
      // Use the higher of the two, but consider trend
      let suggestedLimit = Math.max(baseSuggestion, maxBuffer);
      
      // Adjust for trend
      if (cat.trend === 'increasing') {
        suggestedLimit *= 1.1; // Add 10% more for increasing trend
      } else if (cat.trend === 'decreasing') {
        suggestedLimit *= 0.95; // Reduce slightly for decreasing trend
      }

      // Round to nearest 10
      suggestedLimit = Math.ceil(suggestedLimit / 10) * 10;

      // Check if budget exists
      const existing = existingBudgets.find(b => b.category === cat.category);
      
      // Determine recommendation
      let recommendation: 'create' | 'increase' | 'decrease' | 'maintain' = 'create';
      let confidence = Math.min(cat.periodsAnalyzed / periodsToAnalyze, 1);
      
      if (existing) {
        if (suggestedLimit > existing.limit * 1.2) {
          recommendation = 'increase';
        } else if (suggestedLimit < existing.limit * 0.8) {
          recommendation = 'decrease';
        } else {
          recommendation = 'maintain';
          confidence = 1;
        }
      }

      return {
        category: cat.category,
        currentBudget: existing?.limit || null,
        suggestedLimit,
        avgSpending: cat.avgPerPeriod,
        maxSpending: cat.maxPerPeriod,
        minSpending: cat.minPerPeriod,
        trend: cat.trend,
        recommendation,
        confidence,
        reasoning: generateReasoning(cat, existing?.limit, suggestedLimit, recommendation),
        periodsAnalyzed: cat.periodsAnalyzed,
      };
    });

    // Calculate overall insights
    const totalAvgSpending = categoryAnalysis.reduce((a, b) => a + b.avgPerPeriod, 0);
    const totalSuggestedBudget = suggestions.reduce((a, b) => a + b.suggestedLimit, 0);
    
    // Get income data for context
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((a, b) => a + b.amount, 0);
    
    const periodsInData = new Set(
      transactions.map(t => {
        const date = new Date(t.date);
        return getPeriodKey(getPeriodForDate(date), date.getFullYear());
      })
    ).size;
    
    const avgIncomePerPeriod = periodsInData > 0 ? totalIncome / periodsInData : 0;

    return NextResponse.json({
      suggestions,
      insights: {
        totalAvgSpendingPerPeriod: totalAvgSpending,
        totalSuggestedBudget,
        avgIncomePerPeriod,
        budgetToIncomeRatio: avgIncomePerPeriod > 0 ? (totalSuggestedBudget / avgIncomePerPeriod) * 100 : 0,
        categoriesCount: categoryAnalysis.length,
        periodsAnalyzed: recentPeriods.length,
      },
      currentPeriod: {
        id: currentPeriod.id,
        year: currentPeriod.year,
        key: currentPeriodKey,
      },
      existingBudgets: existingBudgets.map(b => ({
        category: b.category,
        limit: b.limit,
      })),
    });
  } catch (error) {
    console.error('Error generating budget suggestions:', error);
    return NextResponse.json({ error: 'Failed to generate suggestions' }, { status: 500 });
  }
}

function generateReasoning(
  cat: CategorySpending, 
  currentBudget: number | undefined, 
  suggested: number,
  recommendation: string
): string {
  const trendText = cat.trend === 'increasing' 
    ? 'spending has been trending upward' 
    : cat.trend === 'decreasing' 
      ? 'spending has been trending downward' 
      : 'spending has been relatively stable';

  if (recommendation === 'create') {
    return `Based on ${cat.periodsAnalyzed} periods of data, your average spending is ${cat.avgPerPeriod.toFixed(0)} with ${trendText}. Suggesting a budget of ${suggested.toFixed(0)} to accommodate typical spending plus a small buffer.`;
  }

  if (recommendation === 'increase') {
    const percentIncrease = ((suggested - (currentBudget || 0)) / (currentBudget || 1)) * 100;
    return `Your current budget of ${currentBudget} is lower than your average spending (${cat.avgPerPeriod.toFixed(0)}). ${trendText.charAt(0).toUpperCase() + trendText.slice(1)}. Consider increasing by ${percentIncrease.toFixed(0)}% to avoid overspending.`;
  }

  if (recommendation === 'decrease') {
    const percentDecrease = (((currentBudget || 0) - suggested) / (currentBudget || 1)) * 100;
    return `Your current budget of ${currentBudget} is higher than needed. Your average spending is ${cat.avgPerPeriod.toFixed(0)} and ${trendText}. You could reduce your budget by ${percentDecrease.toFixed(0)}% and still have a comfortable buffer.`;
  }

  return `Your current budget of ${currentBudget} aligns well with your spending patterns. Average spending is ${cat.avgPerPeriod.toFixed(0)} and ${trendText}. No changes needed.`;
}
