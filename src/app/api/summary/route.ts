import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// GET summary data for dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Month name like "January"

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

    // Get budgets for the specified month
    let budgets: Array<{ id: string; category: string; month: string; limit: number }> = [];
    if (month) {
      budgets = await db.budget.findMany({
        where: { month },
      });
    }

    // Calculate spending by category for the month
    const monthSpending: Record<string, number> = {};
    if (month) {
      const monthIndex = MONTHS.indexOf(month);

      transactions
        .filter((t) => {
          const txMonth = new Date(t.date).getMonth();
          return t.type === 'expenditure' && txMonth === monthIndex;
        })
        .forEach((t) => {
          monthSpending[t.category] = (monthSpending[t.category] || 0) + t.amount;
        });
    }

    // Get pending recurring bills
    const recurring = await db.recurring.findMany();
    const now = new Date();
    const pendingRecurring = recurring.filter((r) => {
      if (!r.lastDate) return true;
      const lastDate = new Date(r.lastDate);
      return lastDate.getMonth() !== now.getMonth() || lastDate.getFullYear() !== now.getFullYear();
    });

    return NextResponse.json({
      balance: availableBalance,
      totalIncome,
      totalExpenditure,
      regularExpenditure,
      capitalExpenditure,
      totalSavings,
      categorySpending,
      monthSpending,
      budgets,
      pendingRecurring,
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
