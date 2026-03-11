import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all recurring bills
export async function GET() {
  try {
    const recurring = await db.recurring.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(recurring);
  } catch (error) {
    console.error('Error fetching recurring:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring bills' }, { status: 500 });
  }
}

// POST create a new recurring bill
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, amount, category } = body;

    if (!name || !amount || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const recurring = await db.recurring.create({
      data: {
        name,
        amount: parseFloat(amount),
        category,
      },
    });

    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    console.error('Error creating recurring:', error);
    return NextResponse.json({ error: 'Failed to create recurring bill' }, { status: 500 });
  }
}
