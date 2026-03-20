import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Check and update streak
async function updateStreak(): Promise<{ 
  currentStreak: number; 
  longestStreak: number; 
  streakExtended: boolean;
  streakBroken: boolean;
}> {
  const settings = await db.settings.findFirst();
  if (!settings) {
    return { currentStreak: 0, longestStreak: 0, streakExtended: false, streakBroken: false };
  }

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  let currentStreak = settings.currentStreak || 0;
  let longestStreak = settings.longestStreak || 0;
  let streakExtended = false;
  let streakBroken = false;

  if (settings.lastActivityDate === today) {
    // Already logged today, no change
    return { currentStreak, longestStreak, streakExtended: false, streakBroken: false };
  } else if (settings.lastActivityDate === yesterday) {
    // Continuing streak
    currentStreak += 1;
    streakExtended = true;
  } else if (settings.lastActivityDate) {
    // Streak broken
    currentStreak = 1;
    streakBroken = true;
  } else {
    // First activity ever
    currentStreak = 1;
    streakExtended = true;
  }

  // Update longest streak
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  // Save to database
  await db.settings.update({
    where: { id: settings.id },
    data: {
      currentStreak,
      longestStreak,
      lastActivityDate: today,
    }
  });

  return { currentStreak, longestStreak, streakExtended, streakBroken };
}

// Check for achievements to unlock
async function checkAchievements() {
  const unlockedAchievements: { type: string; name: string; points: number }[] = [];
  
  const [settings, transactions, goals, challenges] = await Promise.all([
    db.settings.findFirst(),
    db.transaction.count(),
    db.goal.findMany({ where: { current: { gte: db.goal.fields.target } } }),
    db.challenge.findMany({ where: { status: 'completed' } }),
  ]);

  if (!settings) return unlockedAchievements;

  // Get already unlocked achievements
  const unlocked = await db.achievement.findMany({
    where: { unlockedAt: { not: null } }
  });
  const unlockedSet = new Set(unlocked.map(a => `${a.type}-${a.name}`));

  const checkAndAdd = (type: string, name: string, points: number) => {
    if (!unlockedSet.has(`${type}-${name}`)) {
      unlockedAchievements.push({ type, name, points });
    }
  };

  // Streak achievements
  const streakThresholds = [
    { name: 'Getting Started', requirement: 3, points: 10 },
    { name: 'Week Warrior', requirement: 7, points: 25 },
    { name: 'Fortnight Fighter', requirement: 14, points: 50 },
    { name: 'Monthly Master', requirement: 30, points: 100 },
    { name: 'Unstoppable', requirement: 100, points: 500 },
  ];

  for (const t of streakThresholds) {
    if (settings.currentStreak >= t.requirement) {
      checkAndAdd('streak', t.name, t.points);
    }
  }

  // Transaction milestones
  const txThresholds = [
    { name: 'Transaction Tracker', requirement: 50, points: 25 },
    { name: 'Data Enthusiast', requirement: 200, points: 50 },
    { name: 'Data Master', requirement: 500, points: 100 },
    { name: 'Transaction Titan', requirement: 1000, points: 200 },
  ];

  for (const t of txThresholds) {
    if (transactions >= t.requirement) {
      checkAndAdd('milestone', t.name, t.points);
    }
  }

  // First achievements
  if (transactions >= 1) checkAndAdd('first', 'First Transaction', 5);
  
  const budgets = await db.budget.count();
  if (budgets >= 1) checkAndAdd('first', 'First Budget', 10);
  
  const goalCount = await db.goal.count();
  if (goalCount >= 1) checkAndAdd('first', 'First Goal', 10);
  
  const challengeCount = await db.challenge.count();
  if (challengeCount >= 1) checkAndAdd('first', 'First Challenge', 15);

  // Goal achievements
  const completedGoals = goals.filter(g => g.current >= g.target).length;
  if (completedGoals >= 1) checkAndAdd('goal', 'Goal Getter', 50);
  if (completedGoals >= 3) checkAndAdd('goal', 'Dream Chaser', 100);
  if (completedGoals >= 5) checkAndAdd('goal', 'Dream Achiever', 200);

  return unlockedAchievements;
}

// GET gamification stats
export async function GET() {
  try {
    const settings = await db.settings.findFirst();
    
    const [
      transactionCount,
      goalCount,
      completedGoals,
      activeChallenges,
      completedChallenges,
      achievements
    ] = await Promise.all([
      db.transaction.count(),
      db.goal.count(),
      db.goal.count({ where: { current: { gte: db.goal.fields.target } } }),
      db.challenge.count({ where: { status: 'active' } }),
      db.challenge.count({ where: { status: 'completed' } }),
      db.achievement.count({ where: { unlockedAt: { not: null } } }),
    ]);

    return NextResponse.json({
      points: settings?.totalPoints || 0,
      streak: {
        current: settings?.currentStreak || 0,
        longest: settings?.longestStreak || 0,
        lastActivity: settings?.lastActivityDate || null,
      },
      stats: {
        transactions: transactionCount,
        goals: goalCount,
        completedGoals,
        activeChallenges,
        completedChallenges,
        achievements,
      }
    });
  } catch (error) {
    console.error('Error fetching gamification stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}

// POST - Record activity and check for achievements
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    let result: Record<string, unknown> = {};

    switch (action) {
      case 'log_transaction':
        // Update streak when logging a transaction
        const streakResult = await updateStreak();
        const achievements = await checkAchievements();
        
        result = {
          streak: streakResult,
          achievements: achievements.length > 0 ? achievements : undefined,
          pointsEarned: achievements.reduce((sum, a) => sum + a.points, 0) + (streakResult.streakExtended ? 1 : 0),
        };

        // Award daily point for logging
        const settings = await db.settings.findFirst();
        if (settings) {
          await db.settings.update({
            where: { id: settings.id },
            data: { totalPoints: { increment: 1 } }
          });
        }
        break;

      case 'check_achievements':
        const newAchievements = await checkAchievements();
        result = { achievements: newAchievements };
        break;

      case 'update_streak':
        const streak = await updateStreak();
        result = { streak };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing gamification action:', error);
    return NextResponse.json({ error: 'Failed to process action' }, { status: 500 });
  }
}
