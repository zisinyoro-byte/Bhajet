import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST initialize default data
export async function POST() {
  try {
    // Check if already initialized
    const existingCategories = await db.category.count();
    const existingSettings = await db.settings.findFirst();

    // Create default settings if none exist
    if (!existingSettings) {
      await db.settings.create({
        data: {
          currency: 'USD',
          theme: 'light',
        },
      });
    }

    // Create default categories if none exist
    if (existingCategories === 0) {
      const defaultCategories = [
        { name: 'Salary', type: 'income', icon: '💰' },
        { name: 'Investment', type: 'income', icon: '📈' },
        { name: 'Other Income', type: 'income', icon: '💵' },
        { name: 'Food', type: 'expense', icon: '🍔' },
        { name: 'Transport', type: 'expense', icon: '🚗' },
        { name: 'Shopping', type: 'expense', icon: '🛍️' },
        { name: 'Housing', type: 'expense', icon: '🏠' },
        { name: 'Health', type: 'expense', icon: '🏥' },
        { name: 'Entertainment', type: 'expense', icon: '🎬' },
        { name: 'Utilities', type: 'expense', icon: '💡' },
        { name: 'Education', type: 'expense', icon: '📚' },
        { name: 'Other', type: 'expense', icon: '📄' },
      ];

      for (const cat of defaultCategories) {
        await db.category.create({ data: cat });
      }
    }

    return NextResponse.json({ success: true, message: 'Initialized successfully' });
  } catch (error) {
    console.error('Error initializing data:', error);
    return NextResponse.json({ error: 'Failed to initialize data' }, { status: 500 });
  }
}
