import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE budget
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    await db.budget.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
