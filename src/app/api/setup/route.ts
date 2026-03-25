import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Check environment variables (without exposing secrets)
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDirectUrl = !!process.env.DIRECT_DATABASE_URL;

    // Try to connect and query
    try {
      const settingsCount = await db.settings.count();
      const categoryCount = await db.category.count();
      const transactionCount = await db.transaction.count();

      return NextResponse.json({
        status: 'connected',
        message: 'Database connected successfully!',
        tables: {
          settings: settingsCount,
          categories: categoryCount,
          transactions: transactionCount,
        },
        envCheck: {
          DATABASE_URL: hasDbUrl ? '✅ Set' : '❌ NOT SET',
          DIRECT_DATABASE_URL: hasDirectUrl ? '✅ Set' : '❌ NOT SET',
        },
      });
    } catch (dbError) {
      return NextResponse.json({
        status: 'connection_failed',
        message: dbError instanceof Error ? dbError.message : 'Database query failed',
        envCheck: {
          DATABASE_URL: hasDbUrl ? '✅ Set' : '❌ NOT SET',
          DIRECT_DATABASE_URL: hasDirectUrl ? '✅ Set' : '❌ NOT SET',
        },
        hint: 'Database tables may not exist. Run db:push or call POST /api/setup',
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Create default settings if not exists
    let settings = await db.settings.findFirst();
    if (!settings) {
      settings = await db.settings.create({
        data: {
          currency: 'USD',
          theme: 'light',
        },
      });
    }

    // Create default categories if not exist
    const existingCategories = await db.category.count();
    let categoriesCreated = 0;

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
        categoriesCreated++;
      }
    }

    return NextResponse.json({
      status: 'success',
      message: 'Database initialized successfully!',
      settings,
      categoriesCreated,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Make sure DATABASE_URL and DIRECT_DATABASE_URL are set in Vercel environment variables, then redeploy.',
    }, { status: 500 });
  }
}
