import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// All possible achievements
const ALL_ACHIEVEMENTS = [
  // Streak achievements
  { type: 'streak', name: 'Getting Started', description: 'Log transactions for 3 days in a row', icon: '🔥', points: 10, requirement: 3 },
  { type: 'streak', name: 'Week Warrior', description: 'Log transactions for 7 days in a row', icon: '⚔️', points: 25, requirement: 7 },
  { type: 'streak', name: 'Fortnight Fighter', description: 'Log transactions for 14 days in a row', icon: '🛡️', points: 50, requirement: 14 },
  { type: 'streak', name: 'Monthly Master', description: 'Log transactions for 30 days in a row', icon: '👑', points: 100, requirement: 30 },
  { type: 'streak', name: 'Unstoppable', description: 'Log transactions for 100 days in a row', icon: '💎', points: 500, requirement: 100 },
  
  // First time achievements
  { type: 'first', name: 'First Transaction', description: 'Log your first transaction', icon: '📝', points: 5, requirement: 1 },
  { type: 'first', name: 'First Budget', description: 'Set your first budget', icon: '📊', points: 10, requirement: 1 },
  { type: 'first', name: 'First Goal', description: 'Create your first savings goal', icon: '🎯', points: 10, requirement: 1 },
  { type: 'first', name: 'First Challenge', description: 'Join your first savings challenge', icon: '🏅', points: 15, requirement: 1 },
  
  // Savings achievements
  { type: 'savings', name: 'Penny Pincher', description: 'Save $100 total', icon: '🐷', points: 20, requirement: 100 },
  { type: 'savings', name: 'Savvy Saver', description: 'Save $500 total', icon: '💰', points: 50, requirement: 500 },
  { type: 'savings', name: 'Wealth Builder', description: 'Save $1,000 total', icon: '🏦', points: 100, requirement: 1000 },
  { type: 'savings', name: 'Money Master', description: 'Save $5,000 total', icon: '🏆', points: 250, requirement: 5000 },
  { type: 'savings', name: 'Financial Freedom', description: 'Save $10,000 total', icon: '🌟', points: 500, requirement: 10000 },
  
  // Budget achievements
  { type: 'budget', name: 'Budget Keeper', description: 'Stay under budget for 1 month', icon: '✅', points: 30, requirement: 1 },
  { type: 'budget', name: 'Budget Champion', description: 'Stay under budget for 3 months', icon: '🥇', points: 75, requirement: 3 },
  { type: 'budget', name: 'Budget Legend', description: 'Stay under budget for 6 months', icon: '🎖️', points: 150, requirement: 6 },
  { type: 'budget', name: 'Budget Royalty', description: 'Stay under budget for 12 months', icon: '👸', points: 300, requirement: 12 },
  
  // Milestone achievements
  { type: 'milestone', name: 'Transaction Tracker', description: 'Log 50 transactions', icon: '📈', points: 25, requirement: 50 },
  { type: 'milestone', name: 'Data Enthusiast', description: 'Log 200 transactions', icon: '📉', points: 50, requirement: 200 },
  { type: 'milestone', name: 'Data Master', description: 'Log 500 transactions', icon: '📊', points: 100, requirement: 500 },
  { type: 'milestone', name: 'Transaction Titan', description: 'Log 1,000 transactions', icon: '🗻', points: 200, requirement: 1000 },
  
  // Goal achievements
  { type: 'goal', name: 'Goal Getter', description: 'Complete your first savings goal', icon: '🎉', points: 50, requirement: 1 },
  { type: 'goal', name: 'Dream Chaser', description: 'Complete 3 savings goals', icon: '🌈', points: 100, requirement: 3 },
  { type: 'goal', name: 'Dream Achiever', description: 'Complete 5 savings goals', icon: '⭐', points: 200, requirement: 5 },
];

// GET all achievements with unlock status
export async function GET() {
  try {
    // Get unlocked achievements
    const unlocked = await db.achievement.findMany({
      where: { unlockedAt: { not: null } }
    });

    const unlockedMap = new Map(unlocked.map(a => [`${a.type}-${a.name}`, a]));

    // Merge with all achievements
    const achievements = ALL_ACHIEVEMENTS.map(a => ({
      ...a,
      id: unlockedMap.get(`${a.type}-${a.name}`)?.id || null,
      unlockedAt: unlockedMap.get(`${a.type}-${a.name}`)?.unlockedAt || null,
      unlocked: !!unlockedMap.get(`${a.type}-${a.name}`)?.unlockedAt,
    }));

    // Calculate stats
    const totalPoints = achievements
      .filter(a => a.unlocked)
      .reduce((sum, a) => sum + a.points, 0);

    const stats = {
      total: achievements.length,
      unlocked: achievements.filter(a => a.unlocked).length,
      totalPoints,
      byType: {
        streak: achievements.filter(a => a.type === 'streak' && a.unlocked).length,
        first: achievements.filter(a => a.type === 'first' && a.unlocked).length,
        savings: achievements.filter(a => a.type === 'savings' && a.unlocked).length,
        budget: achievements.filter(a => a.type === 'budget' && a.unlocked).length,
        milestone: achievements.filter(a => a.type === 'milestone' && a.unlocked).length,
        goal: achievements.filter(a => a.type === 'goal' && a.unlocked).length,
      }
    };

    return NextResponse.json({ achievements, stats });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    return NextResponse.json({ error: 'Failed to fetch achievements' }, { status: 500 });
  }
}

// POST - Unlock an achievement
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, name } = body;

    // Check if already unlocked
    const existing = await db.achievement.findFirst({
      where: { type, name }
    });

    if (existing?.unlockedAt) {
      return NextResponse.json({ alreadyUnlocked: true });
    }

    const achievement = ALL_ACHIEVEMENTS.find(a => a.type === type && a.name === name);
    if (!achievement) {
      return NextResponse.json({ error: 'Achievement not found' }, { status: 404 });
    }

    // Unlock the achievement
    const unlocked = await db.achievement.upsert({
      where: { type_name: { type, name } },
      create: {
        type,
        name,
        description: achievement.description,
        icon: achievement.icon,
        points: achievement.points,
        unlockedAt: new Date(),
      },
      update: {
        unlockedAt: new Date(),
      }
    });

    // Award points to user
    const settings = await db.settings.findFirst();
    if (settings) {
      await db.settings.update({
        where: { id: settings.id },
        data: { totalPoints: { increment: achievement.points } }
      });
    }

    return NextResponse.json({ 
      achievement: unlocked,
      pointsEarned: achievement.points
    });
  } catch (error) {
    console.error('Error unlocking achievement:', error);
    return NextResponse.json({ error: 'Failed to unlock achievement' }, { status: 500 });
  }
}
