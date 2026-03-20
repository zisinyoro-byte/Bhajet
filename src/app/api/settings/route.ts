import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET settings
export async function GET() {
  try {
    let settings = await db.settings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await db.settings.create({
        data: {
          currency: 'USD',
          theme: 'light',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// PUT update settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      currency, 
      theme, 
      pin, 
      biometricEnabled,
      email,
      emailReportFrequency,
      notificationsEnabled,
      billReminderDays 
    } = body;

    let settings = await db.settings.findFirst();

    if (!settings) {
      settings = await db.settings.create({
        data: {
          currency: currency || 'USD',
          theme: theme || 'light',
          pin: pin || null,
          biometricEnabled: biometricEnabled ?? false,
          email: email || null,
          emailReportFrequency: emailReportFrequency || 'none',
          notificationsEnabled: notificationsEnabled ?? false,
          billReminderDays: billReminderDays ?? 3,
        },
      });
    } else {
      const updateData: Record<string, unknown> = {};

      if (currency) updateData.currency = currency;
      if (theme) updateData.theme = theme;
      if (pin !== undefined) updateData.pin = pin || null;
      if (biometricEnabled !== undefined) updateData.biometricEnabled = biometricEnabled;
      if (email !== undefined) updateData.email = email || null;
      if (emailReportFrequency !== undefined) updateData.emailReportFrequency = emailReportFrequency;
      if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
      if (billReminderDays !== undefined) updateData.billReminderDays = billReminderDays;

      settings = await db.settings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
