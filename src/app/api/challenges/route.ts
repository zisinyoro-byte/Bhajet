import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Default challenges templates
const CHALLENGE_TEMPLATES = [
  {
    name: '52-Week Savings Challenge',
    description: 'Save $1 in week 1, $2 in week 2, up to $52 in week 52. Total: $1,378!',
    type: '52week',
    target: 1378,
    points: 500,
  },
  {
    name: 'No-Spend Weekend',
    description: 'Go an entire weekend without spending any money',
    type: 'nospend',
    target: 2, // 2 days
    points: 50,
  },
  {
    name: 'No-Spend Week',
    description: 'Go 7 days without any non-essential spending',
    type: 'nospend',
    target: 7,
    points: 150,
  },
  {
    name: 'Monthly Savings Goal',
    description: 'Save a specific amount this month',
    type: 'monthly',
    target: 500,
    points: 200,
  },
  {
    name: 'Coffee Detox',
    description: 'Skip buying coffee for 30 days',
    type: 'nospend',
    target: 30,
    points: 100,
  },
  {
    name: 'Pack Lunch Challenge',
    description: 'Bring lunch from home for 20 work days',
    type: 'custom',
    target: 20,
    points: 100,
  },
];

// GET all challenges
export async function GET() {
  try {
    const challenges = await db.challenge.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Calculate progress for active challenges
    const now = new Date().toISOString().split('T')[0];
    
    const challengesWithProgress = challenges.map(c => {
      let progress = 0;
      
      if (c.type === '52week') {
        // Calculate week number since start
        const startWeek = Math.floor((Date.now() - new Date(c.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
        const expectedSavings = (startWeek * (startWeek + 1)) / 2; // Sum of 1 to startWeek
        progress = Math.min((c.current / c.target) * 100, 100);
      } else {
        progress = Math.min((c.current / c.target) * 100, 100);
      }

      return {
        ...c,
        progress,
        isExpired: c.endDate && now > c.endDate,
        daysRemaining: c.endDate 
          ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
          : null,
      };
    });

    return NextResponse.json({ 
      challenges: challengesWithProgress,
      templates: CHALLENGE_TEMPLATES 
    });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return NextResponse.json({ error: 'Failed to fetch challenges' }, { status: 500 });
  }
}

// POST - Create or update challenge
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      name, 
      description, 
      type, 
      target, 
      endDate,
      action // 'create', 'update', 'complete', 'fail', 'deposit'
    } = body;

    if (action === 'create') {
      const now = new Date().toISOString().split('T')[0];
      
      const challenge = await db.challenge.create({
        data: {
          name,
          description,
          type,
          target: parseFloat(target),
          startDate: now,
          endDate,
          status: 'active',
        }
      });

      return NextResponse.json({ challenge });
    }

    if (action === 'deposit') {
      const { id, amount } = body;
      
      const challenge = await db.challenge.update({
        where: { id },
        data: {
          current: { increment: parseFloat(amount) }
        }
      });

      // Check if completed
      if (challenge.current >= challenge.target) {
        const updated = await db.challenge.update({
          where: { id },
          data: { status: 'completed' }
        });

        // Award points
        const settings = await db.settings.findFirst();
        if (settings) {
          await db.settings.update({
            where: { id: settings.id },
            data: { totalPoints: { increment: challenge.points } }
          });
        }

        return NextResponse.json({ 
          challenge: updated,
          completed: true,
          pointsEarned: challenge.points
        });
      }

      return NextResponse.json({ challenge });
    }

    if (action === 'complete' || action === 'fail') {
      const { id } = body;
      
      const challenge = await db.challenge.update({
        where: { id },
        data: { status: action === 'complete' ? 'completed' : 'failed' }
      });

      if (action === 'complete') {
        const settings = await db.settings.findFirst();
        if (settings) {
          await db.settings.update({
            where: { id: settings.id },
            data: { totalPoints: { increment: challenge.points } }
          });
        }
      }

      return NextResponse.json({ challenge });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing challenge:', error);
    return NextResponse.json({ error: 'Failed to manage challenge' }, { status: 500 });
  }
}

// DELETE challenge
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Challenge ID required' }, { status: 400 });
    }

    await db.challenge.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting challenge:', error);
    return NextResponse.json({ error: 'Failed to delete challenge' }, { status: 500 });
  }
}
