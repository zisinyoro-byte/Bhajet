import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCurrentPeriod, getPeriodKey, parsePeriodKey, getPeriodDates } from '@/lib/periods';

// GET all budgets or filter by period
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period'); // Period key like "2024-P3"
    const category = searchParams.get('category');

    let where: Prisma.BudgetWhereInput = {};

    if (period) {
      where.period = period;
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
    const { category, period, limit } = body;

    if (!category || !period || !limit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate period format
    if (!period.match(/^\d{4}-P\d{1,2}$/)) {
      return NextResponse.json({ error: 'Invalid period format. Use format like "2024-P3"' }, { status: 400 });
    }

    // Upsert: create or update if exists
    const budget = await db.budget.upsert({
      where: {
        category_period: {
          category,
          period,
        },
      },
      update: {
        limit: parseFloat(limit),
      },
      create: {
        category,
        period,
        limit: parseFloat(limit),
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating budget:', error);
    return NextResponse.json({ error: 'Failed to create/update budget' }, { status: 500 });
  }
}
