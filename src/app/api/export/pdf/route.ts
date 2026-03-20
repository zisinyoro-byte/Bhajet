import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'all'; // 'all', 'month', '3months'
    const type = searchParams.get('type') || 'transactions'; // 'transactions', 'summary', 'full'

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

    // Filter transactions by period
    const now = new Date();
    let filteredTransactions = transactions;
    
    if (period === 'month') {
      filteredTransactions = transactions.filter(t => {
        const txDate = new Date(t.date);
        return txDate.getMonth() === now.getMonth() && 
               txDate.getFullYear() === now.getFullYear();
      });
    } else if (period === '3months') {
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      filteredTransactions = transactions.filter(t => {
        return new Date(t.date) >= threeMonthsAgo;
      });
    }

    // Calculate summary
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const balance = totalIncome - totalExpense;

    // Category breakdown
    const categorySpending: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
      });

    // Create PDF
    const doc = new jsPDF();
    const currency = CURRENCIES[settings.currency] || '$';
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let yPos = 20;

    // Header
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235); // Blue
    doc.text('Techmari Budget Report', pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(100);
    const periodText = period === 'all' ? 'All Time' : 
                       period === 'month' ? MONTHS[now.getMonth()] + ' ' + now.getFullYear() :
                       'Last 3 Months';
    doc.text(`Report Period: ${periodText}`, pageWidth / 2, yPos, { align: 'center' });
    
    yPos += 5;
    doc.text(`Generated: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, pageWidth / 2, yPos, { align: 'center' });

    // Summary Section
    yPos += 20;
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Financial Summary', 14, yPos);
    
    yPos += 10;
    doc.setFontSize(11);
    doc.setTextColor(60);
    
    // Summary boxes
    const boxWidth = 58;
    const boxHeight = 25;
    const boxY = yPos;
    
    // Balance box
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(14, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.text('Net Balance', 14 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`${currency}${balance.toFixed(2)}`, 14 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Income box
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(14 + boxWidth + 5, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.text('Total Income', 14 + boxWidth + 5 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`${currency}${totalIncome.toFixed(2)}`, 14 + boxWidth + 5 + boxWidth/2, boxY + 18, { align: 'center' });
    
    // Expense box
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(14 + (boxWidth + 5) * 2, boxY, boxWidth, boxHeight, 3, 3, 'F');
    doc.setTextColor(255);
    doc.setFontSize(9);
    doc.text('Total Expense', 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 8, { align: 'center' });
    doc.setFontSize(14);
    doc.text(`${currency}${totalExpense.toFixed(2)}`, 14 + (boxWidth + 5) * 2 + boxWidth/2, boxY + 18, { align: 'center' });

    // Category Breakdown
    yPos = boxY + boxHeight + 15;
    doc.setTextColor(0);
    doc.setFontSize(16);
    doc.text('Spending by Category', 14, yPos);
    
    yPos += 8;
    const categoryData = Object.entries(categorySpending)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => [cat, `${currency}${amount.toFixed(2)}`, `${((amount / totalExpense) * 100).toFixed(1)}%`]);
    
    if (categoryData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Category', 'Amount', 'Percentage']],
        body: categoryData,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 40, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' },
        },
      });
      // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
      yPos = doc.lastAutoTable.finalY + 15;
    } else {
      yPos += 10;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text('No expenses in this period', 14, yPos);
      yPos += 10;
    }

    // Goals Section
    if (goals.length > 0 && type === 'full') {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setTextColor(0);
      doc.setFontSize(16);
      doc.text('Savings Goals', 14, yPos);
      
      yPos += 8;
      const goalsData = goals.map(g => [
        g.name,
        `${currency}${g.current.toFixed(2)}`,
        `${currency}${g.target.toFixed(2)}`,
        `${((g.current / g.target) * 100).toFixed(0)}%`
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Goal', 'Saved', 'Target', 'Progress']],
        body: goalsData,
        theme: 'grid',
        headStyles: { fillColor: [147, 51, 234], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
      // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Budget Status
    if (budgets.length > 0 && type === 'full') {
      const currentMonth = MONTHS[now.getMonth()];
      const monthBudgets = budgets.filter(b => b.month === currentMonth);
      
      if (monthBudgets.length > 0) {
        if (yPos > 220) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setTextColor(0);
        doc.setFontSize(16);
        doc.text(`Budget Status - ${currentMonth}`, 14, yPos);
        
        yPos += 8;
        const budgetData = monthBudgets.map(b => {
          const spent = categorySpending[b.category] || 0;
          const remaining = b.limit - spent;
          return [
            b.category,
            `${currency}${b.limit.toFixed(2)}`,
            `${currency}${spent.toFixed(2)}`,
            `${currency}${remaining.toFixed(2)}`,
            remaining < 0 ? 'Over Budget!' : 'On Track'
          ];
        });
        
        autoTable(doc, {
          startY: yPos,
          head: [['Category', 'Budget', 'Spent', 'Remaining', 'Status']],
          body: budgetData,
          theme: 'grid',
          headStyles: { fillColor: [245, 158, 11], fontSize: 10 },
          bodyStyles: { fontSize: 9 },
        });
        // @ts-expect-error - jspdf-autotable adds lastAutoTable to doc
        yPos = doc.lastAutoTable.finalY + 15;
      }
    }

    // Recurring Bills
    if (recurring.length > 0 && type === 'full') {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setTextColor(0);
      doc.setFontSize(16);
      doc.text('Recurring Bills', 14, yPos);
      
      yPos += 8;
      const recurringData = recurring.map(r => [
        r.name,
        r.category,
        `${currency}${r.amount.toFixed(2)}`,
        r.lastDate || 'Never'
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['Name', 'Category', 'Amount', 'Last Paid']],
        body: recurringData,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
      });
    }

    // Transactions List (if requested)
    if (type === 'transactions' || type === 'full') {
      if (filteredTransactions.length > 0) {
        doc.addPage();
        yPos = 20;
        
        doc.setTextColor(0);
        doc.setFontSize(16);
        doc.text('Transaction Details', 14, yPos);
        
        yPos += 8;
        
        // Group transactions by date
        const txData = filteredTransactions.slice(0, 100).map(t => [
          t.date,
          t.category,
          t.type === 'income' ? 'Income' : 'Expense',
          t.note || '-',
          `${t.type === 'income' ? '+' : '-'}${currency}${t.amount.toFixed(2)}`
        ]);
        
        autoTable(doc, {
          startY: yPos,
          head: [['Date', 'Category', 'Type', 'Note', 'Amount']],
          body: txData,
          theme: 'striped',
          headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 35 },
            2: { cellWidth: 25 },
            3: { cellWidth: 50 },
            4: { cellWidth: 30, halign: 'right' },
          },
        });
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount} | Techmari Budget | Generated on ${now.toLocaleDateString()}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Return PDF as response
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="techmari-budget-report-${now.toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
