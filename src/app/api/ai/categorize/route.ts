import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

// Default expense categories with keywords for local matching
const DEFAULT_CATEGORIES: Record<string, string[]> = {
  'Food': ['restaurant', 'grocery', 'food', 'pizza', 'burger', 'coffee', 'cafe', 'dinner', 'lunch', 'breakfast', 'uber eats', 'doordash', 'grubhub', 'supermarket', 'bakery'],
  'Transport': ['uber', 'lyft', 'gas', 'fuel', 'parking', 'bus', 'train', 'metro', 'taxi', 'car', 'auto', 'vehicle', 'oil change', 'tire'],
  'Shopping': ['amazon', 'walmart', 'target', 'ebay', 'store', 'mall', 'shop', 'clothes', 'shoes', 'fashion'],
  'Housing': ['rent', 'mortgage', 'utility', 'electric', 'water', 'internet', 'wifi', 'maintenance', 'repair', 'furniture'],
  'Health': ['pharmacy', 'doctor', 'hospital', 'medicine', 'dental', 'gym', 'fitness', 'healthcare', 'clinic', 'vitamin'],
  'Entertainment': ['netflix', 'spotify', 'movie', 'theater', 'concert', 'game', 'hulu', 'disney', 'youtube', 'gaming', 'subscription'],
  'Utilities': ['electric', 'water', 'gas bill', 'phone', 'internet', 'cable', 'utility'],
  'Education': ['book', 'course', 'tuition', 'school', 'college', 'university', 'learning', 'udemy', 'coursera'],
  'Salary': ['salary', 'payroll', 'wage', 'income', 'paycheck'],
  'Investment': ['dividend', 'stock', 'crypto', 'bitcoin', 'investment', 'interest'],
};

// Local categorization using keywords
function localCategorize(text: string): { category: string; confidence: number } | null {
  const lowerText = text.toLowerCase();
  
  // Check default categories
  for (const [category, keywords] of Object.entries(DEFAULT_CATEGORIES)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return { category, confidence: 0.7 };
      }
    }
  }
  
  return null;
}

// AI-powered categorization
async function aiCategorize(description: string, categories: string[]): Promise<{ category: string; confidence: number }> {
  try {
    const zai = await ZAI.create();
    
    const prompt = `You are a financial transaction categorizer. Given a transaction description, categorize it into one of these categories: ${categories.join(', ')}.

Transaction: "${description}"

Respond with ONLY the category name that best fits. If unsure, respond with "Other".

Category:`;

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful financial assistant that categorizes transactions. Always respond with just the category name, nothing else.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 20,
    });

    const category = completion.choices[0]?.message?.content?.trim() || 'Other';
    
    // Check if the returned category exists in our list
    const matchedCategory = categories.find(c => 
      c.toLowerCase() === category.toLowerCase() || 
      c.toLowerCase().includes(category.toLowerCase()) ||
      category.toLowerCase().includes(c.toLowerCase())
    );

    return { 
      category: matchedCategory || 'Other', 
      confidence: matchedCategory ? 0.9 : 0.5 
    };
  } catch (error) {
    console.error('AI categorization error:', error);
    return { category: 'Other', confidence: 0.3 };
  }
}

// Learn from user corrections
async function learnFromCorrection(category: string, description: string) {
  const words = description.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    if (word.length < 3) continue; // Skip short words
    
    const existing = await db.categoryLearning.findUnique({
      where: { category_keyword: { category, keyword: word } }
    });

    if (existing) {
      await db.categoryLearning.update({
        where: { id: existing.id },
        data: { count: { increment: 1 } }
      });
    } else {
      await db.categoryLearning.create({
        data: { category, keyword: word }
      });
    }
  }
}

// Get learned keywords for a category
async function getLearnedCategories(): Promise<Record<string, string[]>> {
  const learning = await db.categoryLearning.findMany({
    where: { count: { gte: 2 } }, // Only keywords seen multiple times
    orderBy: { count: 'desc' }
  });

  const result: Record<string, string[]> = {};
  
  for (const item of learning) {
    if (!result[item.category]) {
      result[item.category] = [];
    }
    result[item.category].push(item.keyword);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, type = 'expense', learn, previousCategory } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    // Handle learning from corrections
    if (learn && previousCategory) {
      await learnFromCorrection(learn, description);
      return NextResponse.json({ success: true, message: 'Learned from correction' });
    }

    // Get existing categories
    const categories = await db.category.findMany({
      where: { type }
    });
    
    const categoryNames = categories.map(c => c.name);

    // Get learned keywords
    const learnedCategories = await getLearnedCategories();

    // Try learned keywords first
    const lowerDesc = description.toLowerCase();
    for (const [category, keywords] of Object.entries(learnedCategories)) {
      for (const keyword of keywords) {
        if (lowerDesc.includes(keyword)) {
          return NextResponse.json({ 
            category, 
            confidence: 0.95,
            source: 'learned'
          });
        }
      }
    }

    // Try local categorization
    const localResult = localCategorize(description);
    if (localResult && categoryNames.includes(localResult.category)) {
      return NextResponse.json({ 
        ...localResult,
        source: 'local'
      });
    }

    // Fall back to AI categorization
    const aiResult = await aiCategorize(description, categoryNames.length > 0 ? categoryNames : Object.keys(DEFAULT_CATEGORIES));
    
    return NextResponse.json({ 
      ...aiResult,
      source: 'ai'
    });
  } catch (error) {
    console.error('Categorization error:', error);
    return NextResponse.json({ error: 'Failed to categorize' }, { status: 500 });
  }
}

// Get suggestions for partial input
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const type = searchParams.get('type') || 'expense';

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    // Get learned keywords that match
    const learning = await db.categoryLearning.findMany({
      where: {
        keyword: { contains: query.toLowerCase() },
        count: { gte: 2 }
      },
      take: 5
    });

    // Get default keywords that match
    const defaultMatches: { keyword: string; category: string }[] = [];
    for (const [category, keywords] of Object.entries(DEFAULT_CATEGORIES)) {
      for (const keyword of keywords) {
        if (keyword.includes(query.toLowerCase()) && !defaultMatches.find(m => m.keyword === keyword)) {
          defaultMatches.push({ keyword, category });
        }
      }
    }

    const suggestions = [
      ...learning.map(l => ({ keyword: l.keyword, category: l.category, source: 'learned' })),
      ...defaultMatches.slice(0, 5).map(m => ({ ...m, source: 'default' }))
    ].slice(0, 8);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestion error:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
