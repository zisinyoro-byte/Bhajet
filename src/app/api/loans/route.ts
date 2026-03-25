import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all loans
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    
    const where = status ? { status } : {};
    
    const loans = await db.loan.findMany({
      where,
      include: {
        repayments: {
          orderBy: { date: 'desc' }
        }
      },
      orderBy: { dateLoaned: 'desc' }
    });

    // Calculate summary stats
    const stats = {
      totalLoaned: loans.reduce((sum, l) => sum + l.amount, 0),
      totalRemaining: loans.reduce((sum, l) => sum + l.remainingAmount, 0),
      totalRepaid: loans.reduce((sum, l) => sum + (l.amount - l.remainingAmount), 0),
      activeLoans: loans.filter(l => l.status === 'active' || l.status === 'partially_paid').length,
      overdueLoans: loans.filter(l => {
        if (!l.dueDate || l.status === 'paid' || l.status === 'written_off') return false;
        return new Date(l.dueDate) < new Date();
      }).length,
    };

    return NextResponse.json({ loans, stats });
  } catch (error) {
    console.error('Error fetching loans:', error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}

// POST - Create new loan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { borrowerName, amount, dateLoaned, dueDate, note } = body;

    if (!borrowerName || !amount || !dateLoaned) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const loan = await db.loan.create({
      data: {
        borrowerName,
        amount: parseFloat(amount),
        remainingAmount: parseFloat(amount),
        dateLoaned,
        dueDate: dueDate || null,
        note: note || null,
        status: 'active',
      }
    });

    return NextResponse.json({ loan });
  } catch (error) {
    console.error('Error creating loan:', error);
    return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 });
  }
}

// PUT - Update loan (add repayment or update status)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, id, repaymentAmount, repaymentDate, repaymentNote, status, note } = body;

    if (!id) {
      return NextResponse.json({ error: 'Loan ID required' }, { status: 400 });
    }

    const loan = await db.loan.findUnique({ 
      where: { id },
      include: { repayments: true }
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    if (action === 'repayment') {
      // Add a repayment
      const amount = parseFloat(repaymentAmount);
      if (!amount || amount <= 0) {
        return NextResponse.json({ error: 'Invalid repayment amount' }, { status: 400 });
      }

      const newRemaining = Math.max(0, loan.remainingAmount - amount);
      const newStatus = newRemaining === 0 ? 'paid' : 'partially_paid';

      // Create repayment record
      await db.loanRepayment.create({
        data: {
          loanId: id,
          amount,
          date: repaymentDate || new Date().toISOString().split('T')[0],
          note: repaymentNote || null,
        }
      });

      // Update loan
      const updatedLoan = await db.loan.update({
        where: { id },
        data: {
          remainingAmount: newRemaining,
          status: newStatus,
        },
        include: { repayments: { orderBy: { date: 'desc' } } }
      });

      return NextResponse.json({ loan: updatedLoan });
    }

    if (action === 'update') {
      // Update loan details
      const updateData: Record<string, unknown> = {};
      if (status) updateData.status = status;
      if (note !== undefined) updateData.note = note;

      const updatedLoan = await db.loan.update({
        where: { id },
        data: updateData,
        include: { repayments: { orderBy: { date: 'desc' } } }
      });

      return NextResponse.json({ loan: updatedLoan });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error updating loan:', error);
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 });
  }
}

// DELETE loan
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Loan ID required' }, { status: 400 });
    }

    // Delete repayments first (cascade should handle this, but be explicit)
    await db.loanRepayment.deleteMany({ where: { loanId: id } });
    
    // Delete loan
    await db.loan.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting loan:', error);
    return NextResponse.json({ error: 'Failed to delete loan' }, { status: 500 });
  }
}
