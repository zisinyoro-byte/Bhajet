'use client';

import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Reminder {
  id: string;
  name: string;
  amount: number;
  category: string;
  daysUntilDue: number;
  needsReminder: boolean;
}

interface NotificationData {
  notificationsEnabled: boolean;
  reminderDays: number;
  reminders: Reminder[];
}

// Request notification permission
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Show a notification
export function showNotification(title: string, options?: NotificationOptions): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('Failed to show notification:', error);
    return null;
  }
}

// Hook for managing notifications
export function useNotifications() {
  const queryClient = useQueryClient();

  // Fetch notification data
  const { data } = useQuery<NotificationData>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications');
      return res.json();
    },
    refetchInterval: 60000, // Check every minute
  });

  // Send test notification
  const testNotification = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      showNotification(data.title, { body: data.message });
    },
  });

  // Send bill reminder notification
  const sendBillReminder = useCallback((reminder: Reminder) => {
    const currency = '$'; // Could get from settings
    showNotification('📅 Bill Reminder', {
      body: `${reminder.name} of ${currency}${reminder.amount.toFixed(2)} is due in ${reminder.daysUntilDue} days!`,
      tag: `bill-${reminder.id}`,
      requireInteraction: true,
    });
  }, []);

  return {
    notificationsEnabled: data?.notificationsEnabled ?? false,
    reminderDays: data?.reminderDays ?? 3,
    reminders: data?.reminders ?? [],
    testNotification: () => testNotification.mutate(),
    sendBillReminder,
    requestPermission: requestNotificationPermission,
  };
}

// Component to handle automatic notification checks
export function NotificationManager() {
  const { reminders, notificationsEnabled, sendBillReminder } = useNotifications();

  useEffect(() => {
    if (!notificationsEnabled || typeof window === 'undefined') return;

    // Check for pending reminders and show notifications
    const showReminders = async () => {
      const hasPermission = await requestNotificationPermission();
      if (!hasPermission) return;

      // Show notifications for pending reminders (limit to 3 at once)
      reminders.slice(0, 3).forEach((reminder, index) => {
        setTimeout(() => sendBillReminder(reminder), index * 1000);
      });
    };

    // Show reminders when component mounts
    if (reminders.length > 0) {
      // Delay to not overwhelm user on page load
      const timer = setTimeout(showReminders, 3000);
      return () => clearTimeout(timer);
    }
  }, [reminders, notificationsEnabled, sendBillReminder]);

  return null;
}
