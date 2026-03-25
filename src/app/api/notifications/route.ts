import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Get pending bill reminders
export async function GET() {
  try {
    const [settings, recurring] = await Promise.all([
      db.settings.findFirst(),
      db.recurring.findMany(),
    ]);

    if (!settings) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    const now = new Date();
    const currentDay = now.getDate();
    const reminderDays = settings.billReminderDays || 3;
    
    // Calculate which bills are due soon
    const reminders = recurring.map(bill => {
      // For simplicity, assume bills are due on the same day each month
      // In a real app, you'd store the due day in the recurring model
      const lastDate = bill.lastDate ? new Date(bill.lastDate) : null;
      const lastMonth = lastDate?.getMonth();
      const currentMonth = now.getMonth();
      
      // If bill was paid this month, no reminder needed
      const paidThisMonth = lastMonth === currentMonth;
      
      // Calculate days until next due (assume bills due on 1st of each month)
      const nextDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const daysUntilDue = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        ...bill,
        paidThisMonth,
        daysUntilDue,
        needsReminder: !paidThisMonth && daysUntilDue <= reminderDays,
      };
    }).filter(b => b.needsReminder);

    return NextResponse.json({
      notificationsEnabled: settings.notificationsEnabled,
      reminderDays: settings.billReminderDays,
      reminders,
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 });
  }
}

// Send test notification
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type = 'test', billName, amount } = body;

    // This endpoint is called by the client to prepare notification data
    // The actual notification is shown by the browser using the Notification API
    
    let message = '';
    let title = 'Techmari Budget';
    
    switch (type) {
      case 'bill_reminder':
        title = '📅 Bill Reminder';
        message = `${billName} of $${amount} is due soon!`;
        break;
      case 'budget_alert':
        title = '⚠️ Budget Alert';
        message = 'You\'re close to exceeding your budget limit!';
        break;
      case 'goal_achieved':
        title = '🎉 Goal Achieved!';
        message = 'Congratulations! You\'ve reached your savings goal!';
        break;
      case 'weekly_summary':
        title = '📊 Weekly Summary';
        message = 'Your weekly financial summary is ready to view.';
        break;
      default:
        title = '🔔 Techmari Budget';
        message = 'Notifications are working correctly!';
    }

    return NextResponse.json({ 
      success: true, 
      title,
      message,
    });
  } catch (error) {
    console.error('Error preparing notification:', error);
    return NextResponse.json({ error: 'Failed to prepare notification' }, { status: 500 });
  }
}
