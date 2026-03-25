import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentPeriod, getPeriodDates, getPeriodForDate, getPeriodKey, parsePeriodKey, getAllPeriodsForYear, PERIOD_NAMES } from '@/lib/periods';

interface PeriodData {
  periodKey: string;
  periodNumber: number;
  year: number;
  income: number;
  expenditure: number;
  regularExpenditure: number;
  capitalExpenditure: number;
}

interface DailyData {
  date: string;
  income: number;
  expenditure: number;
}

interface CategoryAnalysis {
  category: string;
  amount: number;
  percentage: number;
  count: number;
  averagePerTransaction: number;
}

// GET comprehensive analysis data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // 'week', 'month', '3months', 'year', 'all'
    const compareWith = searchParams.get('compareWith'); // Period key to compare with (e.g., "2024-P2")
    const currentPeriodKeyParam = searchParams.get('currentPeriod'); // Period key for current period view

    // Get all transactions
    const transactions = await db.transaction.findMany({
      orderBy: { date: 'asc' }
    });

    // Get loans data
    const loans = await db.loan.findMany({
      include: { repayments: true }
    });

    // Get savings goals
    const goals = await db.goal.findMany();

    // Get budgets
    const budgets = await db.budget.findMany();

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date | null = null;

    switch (period) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '3months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = null;
    }

    // Filter transactions by period
    const filteredTransactions = startDate
      ? transactions.filter(t => new Date(t.date) >= startDate)
      : transactions;

    // Calculate totals for the period
    let totalIncome = 0;
    let totalExpenditure = 0;
    let regularExpenditure = 0;
    let capitalExpenditure = 0;
    const categoryData: Record<string, { amount: number; count: number }> = {};
    const dailyData: Record<string, { income: number; expenditure: number }> = {};
    const periodData: Record<string, { income: number; expenditure: number; regular: number; capital: number }> = {};

    filteredTransactions.forEach((t) => {
      const date = new Date(t.date);
      const dateStr = t.date;
      const periodNum = getPeriodForDate(date);
      const year = date.getFullYear();
      const periodKey = getPeriodKey(periodNum, year);

      // Initialize daily data
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { income: 0, expenditure: 0 };
      }

      // Initialize period data
      if (!periodData[periodKey]) {
        periodData[periodKey] = { income: 0, expenditure: 0, regular: 0, capital: 0 };
      }

      if (t.type === 'income') {
        totalIncome += t.amount;
        dailyData[dateStr].income += t.amount;
        periodData[periodKey].income += t.amount;
      } else {
        totalExpenditure += t.amount;
        dailyData[dateStr].expenditure += t.amount;
        periodData[periodKey].expenditure += t.amount;

        if (t.expenditureType === 'capital') {
          capitalExpenditure += t.amount;
          periodData[periodKey].capital += t.amount;
        } else {
          regularExpenditure += t.amount;
          periodData[periodKey].regular += t.amount;
        }

        // Category tracking
        if (!categoryData[t.category]) {
          categoryData[t.category] = { amount: 0, count: 0 };
        }
        categoryData[t.category].amount += t.amount;
        categoryData[t.category].count += 1;
      }
    });

    // Calculate category analysis with percentages
    const categoryAnalysis: CategoryAnalysis[] = Object.entries(categoryData)
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        percentage: totalExpenditure > 0 ? (data.amount / totalExpenditure) * 100 : 0,
        count: data.count,
        averagePerTransaction: data.amount / data.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Convert daily data to array and sort
    const dailyDataArray: DailyData[] = Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        income: data.income,
        expenditure: data.expenditure,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Convert period data to array
    const periodDataArray: PeriodData[] = Object.entries(periodData)
      .map(([key, data]) => {
        const { year, period: periodNum } = parsePeriodKey(key);
        return {
          periodKey: key,
          periodNumber: periodNum,
          year,
          income: data.income,
          expenditure: data.expenditure,
          regularExpenditure: data.regular,
          capitalExpenditure: data.capital,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.periodNumber - b.periodNumber;
      });

    // Calculate additional insights
    const transactionCount = filteredTransactions.length;
    const daysInPeriod = startDate
      ? Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      : (transactions.length > 0
        ? Math.ceil((now.getTime() - new Date(transactions[0].date).getTime()) / (24 * 60 * 60 * 1000))
        : 1);

    const avgDailyExpenditure = daysInPeriod > 0 ? totalExpenditure / daysInPeriod : 0;
    const avgDailyIncome = daysInPeriod > 0 ? totalIncome / daysInPeriod : 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenditure) / totalIncome) * 100 : 0;

    // Top spending days
    const topSpendingDays = dailyDataArray
      .filter(d => d.expenditure > 0)
      .sort((a, b) => b.expenditure - a.expenditure)
      .slice(0, 5);

    // Top income days
    const topIncomeDays = dailyDataArray
      .filter(d => d.income > 0)
      .sort((a, b) => b.income - a.income)
      .slice(0, 5);

    // Loans summary
    const totalLoaned = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalRepaid = loans.reduce((sum, l) => {
      return sum + l.repayments.reduce((s, r) => s + r.amount, 0);
    }, 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + l.remainingAmount, 0);

    // Savings summary
    const totalSavings = goals.reduce((sum, g) => sum + g.current, 0);
    const savingsProgress = goals.map(g => ({
      name: g.name,
      current: g.current,
      target: g.target,
      percentage: g.target > 0 ? (g.current / g.target) * 100 : 0,
    }));

    // Budget performance for current period
    const currentPeriod = getCurrentPeriod();
    const currentPeriodKey = getPeriodKey(currentPeriod.id, currentPeriod.year);
    const currentPeriodBudgets = budgets.filter(b => b.period === currentPeriodKey);
    const { startDate: periodStart, endDate: periodEnd } = getPeriodDates(currentPeriod.id, currentPeriod.year);
    
    const budgetPerformance = currentPeriodBudgets.map(b => {
      const spent = transactions
        .filter(t => {
          const txDate = new Date(t.date);
          return t.type === 'expenditure' && 
                 t.category === b.category && 
                 txDate >= periodStart && 
                 txDate <= periodEnd;
        })
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        category: b.category,
        budget: b.limit,
        spent,
        remaining: b.limit - spent,
        percentage: (spent / b.limit) * 100,
        status: spent > b.limit ? 'over' : spent > b.limit * 0.8 ? 'warning' : 'good',
      };
    });

    // Period comparison (enhanced)
    let comparison = null;
    let periodComparisonData = null;
    
    // If compareWith is provided, compare specific periods
    if (compareWith && currentPeriodKeyParam) {
      const { year: currentYear, period: currentPeriodNum } = parsePeriodKey(currentPeriodKeyParam);
      const { year: compareYear, period: comparePeriodNum } = parsePeriodKey(compareWith);
      
      const { startDate: currentStart, endDate: currentEnd } = getPeriodDates(currentPeriodNum, currentYear);
      const { startDate: compareStart, endDate: compareEnd } = getPeriodDates(comparePeriodNum, compareYear);
      
      // Current period transactions
      const currentPeriodTx = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= currentStart && date <= currentEnd;
      });
      
      // Compare period transactions
      const comparePeriodTx = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= compareStart && date <= compareEnd;
      });
      
      const currentIncome = currentPeriodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const currentExpenditure = currentPeriodTx.filter(t => t.type === 'expenditure').reduce((s, t) => s + t.amount, 0);
      const currentRegular = currentPeriodTx.filter(t => t.type === 'expenditure' && t.expenditureType !== 'capital').reduce((s, t) => s + t.amount, 0);
      const currentCapital = currentPeriodTx.filter(t => t.type === 'expenditure' && t.expenditureType === 'capital').reduce((s, t) => s + t.amount, 0);
      
      const compareIncome = comparePeriodTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const compareExpenditure = comparePeriodTx.filter(t => t.type === 'expenditure').reduce((s, t) => s + t.amount, 0);
      const compareRegular = comparePeriodTx.filter(t => t.type === 'expenditure' && t.expenditureType !== 'capital').reduce((s, t) => s + t.amount, 0);
      const compareCapital = comparePeriodTx.filter(t => t.type === 'expenditure' && t.expenditureType === 'capital').reduce((s, t) => s + t.amount, 0);
      
      // Category comparison
      const currentCategories: Record<string, number> = {};
      const compareCategories: Record<string, number> = {};
      
      currentPeriodTx.filter(t => t.type === 'expenditure').forEach(t => {
        currentCategories[t.category] = (currentCategories[t.category] || 0) + t.amount;
      });
      
      comparePeriodTx.filter(t => t.type === 'expenditure').forEach(t => {
        compareCategories[t.category] = (compareCategories[t.category] || 0) + t.amount;
      });
      
      const allCategories = [...new Set([...Object.keys(currentCategories), ...Object.keys(compareCategories)])];
      const categoryComparison = allCategories.map(cat => ({
        category: cat,
        current: currentCategories[cat] || 0,
        previous: compareCategories[cat] || 0,
        change: compareCategories[cat] 
          ? ((currentCategories[cat] || 0) - compareCategories[cat]) / compareCategories[cat] * 100
          : (currentCategories[cat] ? 100 : 0),
      })).sort((a, b) => b.current - a.current);
      
      periodComparisonData = {
        currentPeriod: {
          key: currentPeriodKeyParam,
          income: currentIncome,
          expenditure: currentExpenditure,
          regularExpenditure: currentRegular,
          capitalExpenditure: currentCapital,
          netFlow: currentIncome - currentExpenditure,
          transactionCount: currentPeriodTx.length,
        },
        comparePeriod: {
          key: compareWith,
          income: compareIncome,
          expenditure: compareExpenditure,
          regularExpenditure: compareRegular,
          capitalExpenditure: compareCapital,
          netFlow: compareIncome - compareExpenditure,
          transactionCount: comparePeriodTx.length,
        },
        changes: {
          income: compareIncome > 0 ? ((currentIncome - compareIncome) / compareIncome) * 100 : (currentIncome > 0 ? 100 : 0),
          expenditure: compareExpenditure > 0 ? ((currentExpenditure - compareExpenditure) / compareExpenditure) * 100 : (currentExpenditure > 0 ? 100 : 0),
          netFlow: (currentIncome - currentExpenditure) - (compareIncome - compareExpenditure),
        },
        categoryComparison,
      };
    }
    // Traditional date-based comparison (fallback)
    else if (startDate && period !== 'all') {
      const previousPeriodStart = new Date(startDate);
      const periodLength = now.getTime() - startDate.getTime();

      switch (period) {
        case 'week':
          previousPeriodStart.setTime(previousPeriodStart.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
          break;
        case '3months':
          previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 3);
          break;
        case 'year':
          previousPeriodStart.setFullYear(previousPeriodStart.getFullYear() - 1);
          break;
      }

      const previousTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date >= previousPeriodStart && date < startDate;
      });

      const prevIncome = previousTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const prevExpenditure = previousTransactions
        .filter(t => t.type === 'expenditure')
        .reduce((sum, t) => sum + t.amount, 0);

      comparison = {
        incomeChange: prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : 0,
        expenditureChange: prevExpenditure > 0 ? ((totalExpenditure - prevExpenditure) / prevExpenditure) * 100 : 0,
        previousIncome: prevIncome,
        previousExpenditure: prevExpenditure,
      };
    }

    // Get all periods for the selector
    const allPeriods: { key: string; displayName: string; year: number; period: number }[] = [];
    const thisYear = now.getFullYear();
    for (let y = thisYear; y >= thisYear - 2; y--) {
      for (let p = 12; p >= 1; p--) {
        const key = getPeriodKey(p, y);
        const { startDate: pdStart, endDate: pdEnd } = getPeriodDates(p, y);
        // Only include periods that have ended or are current
        if (pdEnd <= now || (p === currentPeriod.id && y === currentPeriod.year)) {
          allPeriods.push({
            key,
            displayName: `Period ${p} (${pdStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${pdEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${y})`,
            year: y,
            period: p,
          });
        }
      }
    }

    return NextResponse.json({
      period,
      totals: {
        income: totalIncome,
        expenditure: totalExpenditure,
        regularExpenditure,
        capitalExpenditure,
        netFlow: totalIncome - totalExpenditure,
      },
      insights: {
        transactionCount,
        daysInPeriod,
        avgDailyExpenditure,
        avgDailyIncome,
        savingsRate,
      },
      categories: categoryAnalysis,
      topSpendingDays,
      topIncomeDays,
      periodTrend: periodDataArray.slice(-12), // Last 12 periods
      dailyData: dailyDataArray.slice(-30), // Last 30 days
      currentPeriod: {
        id: currentPeriod.id,
        year: currentPeriod.year,
        key: currentPeriodKey,
      },
      allPeriods, // Available periods for comparison selector
      loans: {
        totalLoaned,
        totalRepaid,
        totalOutstanding,
        activeCount: loans.filter(l => l.status === 'active' || l.status === 'partially_paid').length,
      },
      savings: {
        total: totalSavings,
        goals: savingsProgress,
      },
      budgets: budgetPerformance,
      comparison,
      periodComparison: periodComparisonData,
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
