// Custom 12-period system for budget tracking
// Period 1: Jan 1 - Jan 24
// Period 2: Jan 25 - Feb 24
// Period 3: Feb 25 - Mar 24
// Period 4: Mar 25 - Apr 24
// Period 5: Apr 25 - May 24
// Period 6: May 25 - Jun 24
// Period 7: Jun 25 - Jul 24
// Period 8: Jul 25 - Aug 24
// Period 9: Aug 25 - Sep 24
// Period 10: Sep 25 - Oct 24
// Period 11: Oct 25 - Nov 24
// Period 12: Nov 25 - Dec 31

export interface Period {
  id: number; // 1-12
  name: string; // "Period 1", "Period 2", etc.
  startDate: Date;
  endDate: Date;
  year: number;
}

// Period definitions (month and day for start, month and day for end)
// Month is 0-indexed (0 = January, 11 = December)
const PERIOD_DEFINITIONS = [
  { startMonth: 0, startDay: 1, endMonth: 0, endDay: 24 },   // Period 1: Jan 1 - Jan 24
  { startMonth: 0, startDay: 25, endMonth: 1, endDay: 24 },  // Period 2: Jan 25 - Feb 24
  { startMonth: 1, startDay: 25, endMonth: 2, endDay: 24 },  // Period 3: Feb 25 - Mar 24
  { startMonth: 2, startDay: 25, endMonth: 3, endDay: 24 },  // Period 4: Mar 25 - Apr 24
  { startMonth: 3, startDay: 25, endMonth: 4, endDay: 24 },  // Period 5: Apr 25 - May 24
  { startMonth: 4, startDay: 25, endMonth: 5, endDay: 24 },  // Period 6: May 25 - Jun 24
  { startMonth: 5, startDay: 25, endMonth: 6, endDay: 24 },  // Period 7: Jun 25 - Jul 24
  { startMonth: 6, startDay: 25, endMonth: 7, endDay: 24 },  // Period 8: Jul 25 - Aug 24
  { startMonth: 7, startDay: 25, endMonth: 8, endDay: 24 },  // Period 9: Aug 25 - Sep 24
  { startMonth: 8, startDay: 25, endMonth: 9, endDay: 24 },  // Period 10: Sep 25 - Oct 24
  { startMonth: 9, startDay: 25, endMonth: 10, endDay: 24 }, // Period 11: Oct 25 - Nov 24
  { startMonth: 10, startDay: 25, endMonth: 11, endDay: 31 }, // Period 12: Nov 25 - Dec 31
];

const PERIOD_NAMES = [
  'Period 1',
  'Period 2', 
  'Period 3',
  'Period 4',
  'Period 5',
  'Period 6',
  'Period 7',
  'Period 8',
  'Period 9',
  'Period 10',
  'Period 11',
  'Period 12',
];

/**
 * Get the period number (1-12) for a given date
 */
export function getPeriodForDate(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = d.getMonth();
  const day = d.getDate();

  for (let i = 0; i < PERIOD_DEFINITIONS.length; i++) {
    const period = PERIOD_DEFINITIONS[i];
    
    // Handle periods within the same month
    if (period.startMonth === period.endMonth) {
      if (month === period.startMonth && day >= period.startDay && day <= period.endDay) {
        return i + 1;
      }
    } else {
      // Handle periods that span two months
      if (month === period.startMonth && day >= period.startDay) {
        return i + 1;
      }
      if (month === period.endMonth && day <= period.endDay) {
        return i + 1;
      }
    }
  }

  // Fallback (should not reach here)
  return 1;
}

/**
 * Get the year for a period (useful for year transitions)
 * Period 12 (Nov 25 - Dec 31) belongs to its start year
 * Period 1 (Jan 1 - Jan 24) belongs to the current year
 */
export function getYearForPeriod(periodNumber: number, date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // If we're in January and the period is 2-12, it means we're looking at
  // a period from the previous year
  if (month === 0 && periodNumber >= 2) {
    return year - 1;
  }
  
  return year;
}

/**
 * Get the start and end dates for a specific period in a given year
 */
export function getPeriodDates(periodNumber: number, year: number): { startDate: Date; endDate: Date } {
  const periodIndex = periodNumber - 1;
  const period = PERIOD_DEFINITIONS[periodIndex];
  
  const startDate = new Date(year, period.startMonth, period.startDay);
  
  // For period 12, we need to handle the end date specially
  // and also handle leap years for February
  let endDate: Date;
  
  if (periodNumber === 12) {
    // Period 12: Nov 25 - Dec 31
    endDate = new Date(year, 11, 31);
  } else if (periodNumber === 3 && period.endMonth === 1) {
    // Period 3 ends on Feb 24 - need to handle leap year
    const febEndDay = period.endDay; // Always 24, no leap year issue
    endDate = new Date(year, period.endMonth, febEndDay);
  } else {
    endDate = new Date(year, period.endMonth, period.endDay);
  }
  
  return { startDate, endDate };
}

/**
 * Get a period object with all details
 */
export function getPeriod(periodNumber: number, year: number): Period {
  const { startDate, endDate } = getPeriodDates(periodNumber, year);
  
  return {
    id: periodNumber,
    name: PERIOD_NAMES[periodNumber - 1],
    startDate,
    endDate,
    year,
  };
}

/**
 * Get all 12 periods for a given year
 */
export function getAllPeriodsForYear(year: number): Period[] {
  return PERIOD_NAMES.map((name, index) => {
    const periodNumber = index + 1;
    const { startDate, endDate } = getPeriodDates(periodNumber, year);
    
    return {
      id: periodNumber,
      name,
      startDate,
      endDate,
      year,
    };
  });
}

/**
 * Get the current period based on today's date
 */
export function getCurrentPeriod(): Period {
  const now = new Date();
  const periodNumber = getPeriodForDate(now);
  const year = getYearForPeriod(periodNumber, now);
  return getPeriod(periodNumber, year);
}

/**
 * Get the period key for storage (e.g., "2024-P3")
 */
export function getPeriodKey(periodNumber: number, year: number): string {
  return `${year}-P${periodNumber}`;
}

/**
 * Parse a period key (e.g., "2024-P3" -> { year: 2024, period: 3 })
 */
export function parsePeriodKey(key: string): { year: number; period: number } {
  const [yearStr, periodStr] = key.split('-P');
  return {
    year: parseInt(yearStr),
    period: parseInt(periodStr),
  };
}

/**
 * Get all period keys for the current year and previous year
 */
export function getRecentPeriodKeys(): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentPeriod = getPeriodForDate(now);
  
  const keys: string[] = [];
  
  // Add periods from current year up to current period
  for (let p = 1; p <= currentPeriod; p++) {
    keys.push(getPeriodKey(p, currentYear));
  }
  
  // Add all periods from previous year
  for (let p = 1; p <= 12; p++) {
    keys.push(getPeriodKey(p, currentYear - 1));
  }
  
  return keys.reverse(); // Most recent first
}

/**
 * Get display name for a period
 */
export function getPeriodDisplayName(periodNumber: number, year: number): string {
  const period = getPeriod(periodNumber, year);
  const startMonth = period.startDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = period.endDate.toLocaleDateString('en-US', { month: 'short' });
  const startDay = period.startDate.getDate();
  const endDay = period.endDate.getDate();
  
  if (startMonth === endMonth) {
    return `Period ${periodNumber} (${startMonth} ${startDay}-${endDay}, ${year})`;
  }
  
  return `Period ${periodNumber} (${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year})`;
}

/**
 * Get short display name for a period
 */
export function getPeriodShortName(periodNumber: number, year: number): string {
  return `P${periodNumber} ${year}`;
}

/**
 * Check if a date falls within a specific period
 */
export function isDateInPeriod(date: Date | string, periodNumber: number, year: number): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { startDate, endDate } = getPeriodDates(periodNumber, year);
  
  return d >= startDate && d <= endDate;
}

/**
 * Get the next period
 */
export function getNextPeriod(periodNumber: number, year: number): Period {
  if (periodNumber === 12) {
    return getPeriod(1, year + 1);
  }
  return getPeriod(periodNumber + 1, year);
}

/**
 * Get the previous period
 */
export function getPreviousPeriod(periodNumber: number, year: number): Period {
  if (periodNumber === 1) {
    return getPeriod(12, year - 1);
  }
  return getPeriod(periodNumber - 1, year);
}

export { PERIOD_NAMES };
