import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { parsePeriodKey, getPeriodDates, getCurrentPeriod, getPeriodForDate } from '@/lib/periods';

// GET summary data for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period'); // Period key like "2024-P3"

    // Get all transactions
    const transactions = await db.transaction.findMany();

    // Calculate totals
    let totalIncome = 0;
    let totalExpenditure = 0;
    let regularExpenditure = 0;
    let capitalExpenditure = 0;
    const categorySpending: Record<string, number> = {};

    transactions.forEach((t) => {
      if (t.type === 'income') {
        totalIncome += t.amount;
      } else {
        totalExpenditure += t.amount;
        categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        
        // Track expenditure types
        if (t.expenditureType === 'capital') {
          capitalExpenditure += t.amount;
        } else {
          regularExpenditure += t.amount;
        }
      }
    });

    // Get loans data
    const loans = await db.loan.findMany({
      include: { repayments: true }
    });

    const totalLoaned = loans.reduce((sum, l) => sum + l.amount, 0);
    const totalRepaid = loans.reduce((sum, l) => {
      return sum + l.repayments.reduce((s, r) => s + r.amount, 0);
    }, 0);
    const totalOutstanding = loans.reduce((sum, l) => sum + l.remainingAmount, 0);

    // Get savings goals data
    const goals = await db.goal.findMany();
    const totalSavings = goals.reduce((sum, g) => sum + g.current, 0);

    // Available balance = Income - Expenditure - Loans given out + Loans repaid - Savings
    const availableBalance = totalIncome - totalExpenditure - totalLoaned + totalRepaid - totalSavings;

    // Get budgets for the specified period
    let budgets: Array<{ id: string; category: string; period: string; limit: number }> = [];
    if (period) {
      budgets = await db.budget.findMany({
        where: { period },
      });
    }

    // Calculate spending by category for the period
    const periodSpending: Record<string, number> = {};
    if (period) {
      const { year, period: periodNum } = parsePeriodKey(period);
      const { startDate, endDate } = getPeriodDates(periodNum, year);

      transactions
        .filter((t) => {
          const txDate = new Date(t.date);
          return t.type === 'expenditure' && txDate >= startDate && txDate <= endDate;
        })
        .forEach((t) => {
          periodSpending[t.category] = (periodSpending[t.category] || 0) + t.amount;
        });
    }

    // Get pending recurring bills
    // Check if there's a recurring bill that hasn't been recorded in the current period
    const recurring = await db.recurring.findMany();
    const now = new Date();
    const currentPeriod = getCurrentPeriod();
    const { startDate: periodStart, endDate: periodEnd } = getPeriodDates(currentPeriod.id, currentPeriod.year);
    
    const pendingRecurring = recurring.filter((r) => {
      if (!r.lastDate) return true;
      const lastDate = new Date(r.lastDate);
      // Check if last date is before current period start
      return lastDate < periodStart;
    });

    return NextResponse.json({
      balance: availableBalance,
      totalIncome,
      totalExpenditure,
      regularExpenditure,
      capitalExpenditure,
      totalSavings,
      categorySpending,
      periodSpending,
      budgets,
      pendingRecurring,
      currentPeriod: {
        id: currentPeriod.id,
        year: currentPeriod.year,
        key: `${currentPeriod.year}-P${currentPeriod.id}`,
      },
      loans: {
        totalLoaned,
        totalRepaid,
        totalOutstanding,
        activeLoans: loans.filter(l => l.status === 'active' || l.status === 'partially_paid').length,
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
