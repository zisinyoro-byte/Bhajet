import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const CURRENCIES: Record<string, string> = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'INR': '₹',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: EmailData): Promise<boolean> {
  // Use Resend API for sending emails
  // The user needs to set RESEND_API_KEY in their environment variables
  const resendApiKey = process.env.RESEND_API_KEY;
  
  if (!resendApiKey) {
    console.error('RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Techmari Budget <reports@techmari.budget>',
        to: [to],
        subject,
        html,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

function generateReportHTML(
  settings: { currency: string },
  transactions: { type: string; amount: number; category: string; date: string; note: string | null }[],
  budgets: { category: string; month: string; limit: number }[],
  goals: { name: string; target: number; current: number }[],
  recurring: { name: string; amount: number; category: string }[],
  period: 'weekly' | 'monthly'
): string {
  const currency = CURRENCIES[settings.currency] || '$';
  const now = new Date();
  
  // Calculate summary
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Category breakdown
  const categorySpending: Record<string, number> = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
    });

  const topCategories = Object.entries(categorySpending)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Current month budgets
  const currentMonth = MONTHS[now.getMonth()];
  const monthBudgets = budgets.filter(b => b.month === currentMonth);

  const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Techmari Budget ${periodLabel} Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">💰 Techmari Budget</h1>
      <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0 0; font-size: 14px;">${periodLabel} Financial Report</p>
      <p style="color: rgba(255,255,255,0.6); margin: 5px 0 0 0; font-size: 12px;">${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </div>

    <!-- Summary Cards -->
    <div style="padding: 20px;">
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <!-- Balance -->
        <div style="flex: 1; min-width: 150px; background: #eff6ff; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0; text-transform: uppercase;">Net Balance</p>
          <p style="color: ${balance >= 0 ? '#2563eb' : '#dc2626'}; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">
            ${currency}${Math.abs(balance).toFixed(2)}
          </p>
        </div>
        <!-- Income -->
        <div style="flex: 1; min-width: 150px; background: #f0fdf4; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0; text-transform: uppercase;">Income</p>
          <p style="color: #16a34a; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">
            ${currency}${totalIncome.toFixed(2)}
          </p>
        </div>
        <!-- Expenses -->
        <div style="flex: 1; min-width: 150px; background: #fef2f2; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="color: #64748b; font-size: 12px; margin: 0; text-transform: uppercase;">Expenses</p>
          <p style="color: #dc2626; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">
            ${currency}${totalExpense.toFixed(2)}
          </p>
        </div>
      </div>
    </div>

    <!-- Top Spending Categories -->
    ${topCategories.length > 0 ? `
    <div style="padding: 0 20px 20px 20px;">
      <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 15px 0;">📊 Top Spending Categories</h2>
      <div style="background: #f8fafc; border-radius: 12px; overflow: hidden;">
        ${topCategories.map(([cat, amount], index) => {
          const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
          const colors = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'];
          const color = colors[index % colors.length];
          return `
            <div style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-weight: 500; color: #334155;">${cat}</span>
                <span style="color: #64748b;">${currency}${amount.toFixed(2)}</span>
              </div>
              <div style="background: #e2e8f0; border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 4px;"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Budget Status -->
    ${monthBudgets.length > 0 ? `
    <div style="padding: 0 20px 20px 20px;">
      <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 15px 0;">📋 Budget Status (${currentMonth})</h2>
      <div style="background: #f8fafc; border-radius: 12px; overflow: hidden;">
        ${monthBudgets.map(b => {
          const spent = categorySpending[b.category] || 0;
          const percentage = Math.min((spent / b.limit) * 100, 100);
          const isOver = spent > b.limit;
          const remaining = b.limit - spent;
          return `
            <div style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-weight: 500; color: #334155;">${b.category}</span>
                <span style="color: ${isOver ? '#dc2626' : '#16a34a'}; font-size: 12px;">
                  ${isOver ? '⚠️ Over by ' + currency + Math.abs(remaining).toFixed(2) : '✓ ' + currency + remaining.toFixed(2) + ' left'}
                </span>
              </div>
              <div style="background: #e2e8f0; border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: ${isOver ? '#dc2626' : '#2563eb'}; height: 100%; width: ${percentage}%; border-radius: 4px;"></div>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                ${currency}${spent.toFixed(2)} / ${currency}${b.limit.toFixed(2)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Goals Progress -->
    ${goals.length > 0 ? `
    <div style="padding: 0 20px 20px 20px;">
      <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 15px 0;">🎯 Savings Goals</h2>
      <div style="background: #f8fafc; border-radius: 12px; overflow: hidden;">
        ${goals.map(g => {
          const percentage = Math.min((g.current / g.target) * 100, 100);
          return `
            <div style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <span style="font-weight: 500; color: #334155;">${g.name}</span>
                <span style="color: #7c3aed; font-size: 12px;">${percentage.toFixed(0)}%</span>
              </div>
              <div style="background: #e2e8f0; border-radius: 4px; height: 6px; overflow: hidden;">
                <div style="background: #7c3aed; height: 100%; width: ${percentage}%; border-radius: 4px;"></div>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                ${currency}${g.current.toFixed(2)} of ${currency}${g.target.toFixed(2)}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Upcoming Bills -->
    ${recurring.length > 0 ? `
    <div style="padding: 0 20px 20px 20px;">
      <h2 style="color: #1e293b; font-size: 18px; margin: 0 0 15px 0;">📅 Upcoming Recurring Bills</h2>
      <div style="background: #f8fafc; border-radius: 12px; overflow: hidden;">
        ${recurring.slice(0, 5).map(r => `
          <div style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 500; color: #334155;">${r.name}</span>
              <span style="color: #64748b; font-size: 12px; margin-left: 8px;">${r.category}</span>
            </div>
            <span style="color: #dc2626; font-weight: 500;">${currency}${r.amount.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="color: #64748b; font-size: 12px; margin: 0;">
        This report was generated automatically by Techmari Budget.
      </p>
      <p style="color: #94a3b8; font-size: 11px; margin: 10px 0 0 0;">
        To change your email preferences, go to Settings in the app.
      </p>
    </div>

  </div>
</body>
</html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, period = 'weekly' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Fetch all data
    const [settings, transactions, budgets, goals, recurring] = await Promise.all([
      db.settings.findFirst(),
      db.transaction.findMany({ orderBy: { date: 'desc' } }),
      db.budget.findMany(),
      db.goal.findMany(),
      db.recurring.findMany(),
    ]);

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Filter transactions based on period
    const now = new Date();
    let filteredTransactions = transactions;
    
    if (period === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= weekAgo);
    } else if (period === 'monthly') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= monthAgo);
    }

    // Generate HTML report
    const html = generateReportHTML(
      settings,
      filteredTransactions,
      budgets,
      goals,
      recurring,
      period
    );

    const periodLabel = period === 'weekly' ? 'Weekly' : 'Monthly';
    const subject = `💰 Your ${periodLabel} Budget Report - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    // Send email
    const sent = await sendEmail({
      to: email,
      subject,
      html,
    });

    if (!sent) {
      return NextResponse.json({ 
        error: 'Failed to send email. Make sure RESEND_API_KEY is configured.' 
      }, { status: 500 });
    }

    // Update last report sent
    await db.settings.update({
      where: { id: settings.id },
      data: { lastReportSent: now },
    });

    return NextResponse.json({ 
      success: true, 
      message: `${periodLabel} report sent to ${email}` 
    });
  } catch (error) {
    console.error('Error sending email report:', error);
    return NextResponse.json({ error: 'Failed to send email report' }, { status: 500 });
  }
}

// Preview endpoint (returns HTML instead of sending)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'weekly') as 'weekly' | 'monthly';

    // Fetch all data
    const [settings, transactions, budgets, goals, recurring] = await Promise.all([
      db.settings.findFirst(),
      db.transaction.findMany({ orderBy: { date: 'desc' } }),
      db.budget.findMany(),
      db.goal.findMany(),
      db.recurring.findMany(),
    ]);

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    // Filter transactions based on period
    const now = new Date();
    let filteredTransactions = transactions;
    
    if (period === 'weekly') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= weekAgo);
    } else if (period === 'monthly') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= monthAgo);
    }

    // Generate HTML report
    const html = generateReportHTML(
      settings,
      filteredTransactions,
      budgets,
      goals,
      recurring,
      period
    );

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  }
}
