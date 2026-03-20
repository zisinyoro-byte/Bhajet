import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthlyData {
  month: string;
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
    const monthlyData: Record<string, { income: number; expenditure: number; regular: number; capital: number }> = {};

    filteredTransactions.forEach((t) => {
      const date = new Date(t.date);
      const dateStr = t.date;
      const monthKey = `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

      // Initialize daily data
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { income: 0, expenditure: 0 };
      }

      // Initialize monthly data
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expenditure: 0, regular: 0, capital: 0 };
      }

      if (t.type === 'income') {
        totalIncome += t.amount;
        dailyData[dateStr].income += t.amount;
        monthlyData[monthKey].income += t.amount;
      } else {
        totalExpenditure += t.amount;
        dailyData[dateStr].expenditure += t.amount;
        monthlyData[monthKey].expenditure += t.amount;

        if (t.expenditureType === 'capital') {
          capitalExpenditure += t.amount;
          monthlyData[monthKey].capital += t.amount;
        } else {
          regularExpenditure += t.amount;
          monthlyData[monthKey].regular += t.amount;
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

    // Convert monthly data to array
    const monthlyDataArray: MonthlyData[] = Object.entries(monthlyData)
      .map(([key, data]) => {
        const [monthName, yearStr] = key.split(' ');
        return {
          month: monthName,
          year: parseInt(yearStr),
          income: data.income,
          expenditure: data.expenditure,
          regularExpenditure: data.regular,
          capitalExpenditure: data.capital,
        };
      })
      .sort((a, b) => {
        const monthA = MONTHS.indexOf(a.month);
        const monthB = MONTHS.indexOf(b.month);
        if (a.year !== b.year) return a.year - b.year;
        return monthA - monthB;
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

    // Budget performance for current month
    const currentMonthName = MONTHS[now.getMonth()];
    const currentMonthBudgets = budgets.filter(b => b.month === currentMonthName);
    const budgetPerformance = currentMonthBudgets.map(b => {
      const spent = filteredTransactions
        .filter(t => t.type === 'expenditure' && t.category === b.category)
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

    // Previous period comparison (if applicable)
    let comparison = null;
    if (startDate && period !== 'all') {
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
      monthlyTrend: monthlyDataArray.slice(-12), // Last 12 months
      dailyData: dailyDataArray.slice(-30), // Last 30 days
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
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    return NextResponse.json({ error: 'Failed to fetch analysis' }, { status: 500 });
  }
}
