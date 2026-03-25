import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET single transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const transaction = await db.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}

// PUT update transaction
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type, amount, category, date, note, receipt, expenditureType, merchantName } = body;

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Normalize type
    const normalizedType = type === 'expense' ? 'expenditure' : type;

    const transaction = await db.transaction.update({
      where: { id },
      data: {
        type: normalizedType || existing.type,
        amount: amount !== undefined ? parseFloat(amount) : existing.amount,
        category: category || existing.category,
        date: date || existing.date,
        note: note !== undefined ? note : existing.note,
        receipt: receipt !== undefined ? receipt : existing.receipt,
        expenditureType: expenditureType !== undefined ? expenditureType : existing.expenditureType,
        merchantName: merchantName !== undefined ? merchantName : existing.merchantName,
      },
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

// DELETE transaction
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.transaction.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    await db.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
