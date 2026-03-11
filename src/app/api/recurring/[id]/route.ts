import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT update recurring (mainly for updating lastDate)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, amount, category, lastDate } = body;

    const existing = await db.recurring.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Recurring not found' }, { status: 404 });
    }

    const recurring = await db.recurring.update({
      where: { id },
      data: {
        name: name || existing.name,
        amount: amount !== undefined ? parseFloat(amount) : existing.amount,
        category: category || existing.category,
        lastDate: lastDate !== undefined ? lastDate : existing.lastDate,
      },
    });

    return NextResponse.json(recurring);
  } catch (error) {
    console.error('Error updating recurring:', error);
    return NextResponse.json({ error: 'Failed to update recurring' }, { status: 500 });
  }
}

// DELETE recurring
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.recurring.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Recurring not found' }, { status: 404 });
    }

    await db.recurring.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring:', error);
    return NextResponse.json({ error: 'Failed to delete recurring' }, { status: 500 });
  }
}
