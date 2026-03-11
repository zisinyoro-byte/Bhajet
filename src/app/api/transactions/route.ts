import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET all transactions
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const expenditureType = searchParams.get('expenditureType');

    let where: Prisma.TransactionWhereInput = {};

    if (type && (type === 'income' || type === 'expenditure')) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    if (expenditureType && (expenditureType === 'regular' || expenditureType === 'capital')) {
      where.expenditureType = expenditureType;
    }

    if (search) {
      where.OR = [
        { category: { contains: search } },
        { note: { contains: search } },
        { merchantName: { contains: search } },
      ];
    }

    const transactions = await db.transaction.findMany({
      where,
      orderBy: { date: 'desc' },
      take: limit ? parseInt(limit) : undefined,
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

// POST create a new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      type, 
      amount, 
      category, 
      date, 
      note, 
      receipt,
      expenditureType,
      // Receipt scanner fields
      merchantName,
      receiptDate,
      receiptTotal,
      isFromReceipt
    } = body;

    if (!type || !amount || !category || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Support both 'expense' (legacy) and 'expenditure'
    const normalizedType = type === 'expense' ? 'expenditure' : type;
    
    if (normalizedType !== 'income' && normalizedType !== 'expenditure') {
      return NextResponse.json({ error: 'Invalid transaction type. Must be "income" or "expenditure"' }, { status: 400 });
    }

    // Validate expenditureType for expenditure transactions
    if (normalizedType === 'expenditure' && expenditureType) {
      if (expenditureType !== 'regular' && expenditureType !== 'capital') {
        return NextResponse.json({ error: 'Invalid expenditure type. Must be "regular" or "capital"' }, { status: 400 });
      }
    }

    const transaction = await db.transaction.create({
      data: {
        type: normalizedType,
        amount: parseFloat(amount),
        category,
        date,
        note: note || null,
        receipt: receipt || null,
        expenditureType: normalizedType === 'expenditure' ? (expenditureType || 'regular') : null,
        merchantName: merchantName || null,
        receiptDate: receiptDate || null,
        receiptTotal: receiptTotal ? parseFloat(receiptTotal) : null,
        isFromReceipt: isFromReceipt || false,
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}
