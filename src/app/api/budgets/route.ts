import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// GET all budgets or filter by month
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const category = searchParams.get('category');

    let where: Prisma.BudgetWhereInput = {};

    if (month) {
      where.month = month;
    }

    if (category) {
      where.category = category;
    }

    const budgets = await db.budget.findMany({
      where,
      orderBy: [{ category: 'asc' }],
    });

    return NextResponse.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

// POST create or update a budget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, month, limit } = body;

    if (!category || !month || !limit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Upsert: create or update if exists
    const budget = await db.budget.upsert({
      where: {
        category_month: {
          category,
          month,
        },
      },
      update: {
        limit: parseFloat(limit),
      },
      create: {
        category,
        month,
        limit: parseFloat(limit),
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating budget:', error);
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 });
  }
}
