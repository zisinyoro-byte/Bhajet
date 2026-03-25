// Haptic feedback utility using Vibration API

export type HapticStyle = 
  | 'light'      // Short, light tap
  | 'medium'     // Medium tap
  | 'heavy'      // Strong tap
  | 'success'    // Success notification
  | 'warning'    // Warning notification
  | 'error'      // Error notification
  | 'selection'  // Item selection
  | 'impact'     // Impact feedback
  | 'toggle';    // Toggle switch

const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 40,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 50, 30, 50, 30],
  selection: 5,
  impact: 25,
  toggle: 15,
};

let hapticEnabled = true;

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

/**
 * Enable or disable haptic feedback
 */
export function setHapticEnabled(enabled: boolean): void {
  hapticEnabled = enabled;
}

/**
 * Get current haptic enabled state
 */
export function isHapticEnabled(): boolean {
  return hapticEnabled;
}

/**
 * Trigger haptic feedback
 */
export function haptic(style: HapticStyle = 'light'): void {
  if (!hapticEnabled || !isHapticSupported()) return;

  const pattern = HAPTIC_PATTERNS[style];
  
  try {
    if (Array.isArray(pattern)) {
      navigator.vibrate(pattern);
    } else {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Silently fail if vibration is not allowed
    console.debug('Haptic feedback failed:', e);
  }
}

/**
 * Stop any ongoing vibration
 */
export function stopHaptic(): void {
  if (isHapticSupported()) {
    navigator.vibrate(0);
  }
}

/**
 * Custom haptic pattern
 */
export function customHaptic(pattern: number | number[]): void {
  if (!hapticEnabled || !isHapticSupported()) return;
  
  try {
    navigator.vibrate(pattern);
  } catch (e) {
    console.debug('Custom haptic feedback failed:', e);
  }
}

// Convenience functions for common actions
export const haptics = {
  buttonPress: () => haptic('light'),
  buttonLongPress: () => haptic('medium'),
  success: () => haptic('success'),
  warning: () => haptic('warning'),
  error: () => haptic('error'),
  selection: () => haptic('selection'),
  toggle: () => haptic('toggle'),
  delete: () => haptic('heavy'),
  save: () => haptic('success'),
  cancel: () => haptic('light'),
  swipe: () => haptic('selection'),
  pullToRefresh: () => haptic('medium'),
  notification: () => haptic('impact'),
  tabSwitch: () => haptic('light'),
  modalOpen: () => haptic('medium'),
  modalClose: () => haptic('light'),
  itemExpanded: () => haptic('selection'),
  itemCollapsed: () => haptic('selection'),
};
