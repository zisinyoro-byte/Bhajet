import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all goals
export async function GET() {
  try {
    const goals = await db.goal.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

// POST create a new goal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, target } = body;

    if (!name || !target) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const goal = await db.goal.create({
      data: {
        name,
        target: parseFloat(target),
        current: 0,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('Error creating goal:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
