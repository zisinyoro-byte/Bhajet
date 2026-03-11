import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET single goal
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const goal = await db.goal.findUnique({ where: { id } });

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    return NextResponse.json(goal);
  } catch (error) {
    console.error('Error fetching goal:', error);
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 });
  }
}

// PUT update goal (for deposits and withdrawals)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, target, current, deposit, withdraw } = body;

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const updateData: { name?: string; target?: number; current?: number } = {};

    if (name) updateData.name = name;
    if (target !== undefined) updateData.target = parseFloat(target);
    if (current !== undefined) updateData.current = parseFloat(current);
    if (deposit !== undefined) {
      // Add funds to savings
      updateData.current = existing.current + parseFloat(deposit);
    }
    if (withdraw !== undefined) {
      // Withdraw funds from savings (cannot go below 0)
      const withdrawAmount = parseFloat(withdraw);
      updateData.current = Math.max(0, existing.current - withdrawAmount);
    }

    const goal = await db.goal.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

// DELETE goal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
