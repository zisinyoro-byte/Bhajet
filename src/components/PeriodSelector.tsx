'use client';

import { useState, useMemo } from 'react';
import { 
  getAllPeriodsForYear, 
  getPeriodDisplayName, 
  getPeriodShortName,
  getCurrentPeriod,
  type Period 
} from '@/lib/periods';

interface PeriodSelectorProps {
  selectedPeriod: { id: number; year: number; key: string };
  onPeriodChange: (period: { id: number; year: number; key: string }) => void;
  compact?: boolean;
}

export function PeriodSelector({ selectedPeriod, onPeriodChange, compact = false }: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentPeriod = useMemo(() => getCurrentPeriod(), []);
  const currentYear = currentPeriod.year;
  
  // Generate years (current year and previous year)
  const years = [currentYear, currentYear - 1];
  
  // Get all periods for each year
  const periodsByYear = useMemo(() => {
    const result: Record<number, Period[]> = {};
    years.forEach(year => {
      result[year] = getAllPeriodsForYear(year);
    });
    return result;
  }, [years.join(',')]);

  const selectedPeriodDisplay = getPeriodDisplayName(selectedPeriod.id, selectedPeriod.year);
  const selectedPeriodShort = getPeriodShortName(selectedPeriod.id, selectedPeriod.year);

  const handlePeriodSelect = (period: Period) => {
    onPeriodChange({
      id: period.id,
      year: period.year,
      key: `${period.year}-P${period.id}`,
    });
    setIsOpen(false);
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {selectedPeriodShort}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
              <div className="p-2">
                {years.map(year => (
                  <div key={year} className="mb-2">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 py-1">
                      {year}
                    </div>
                    {periodsByYear[year].map(period => (
                      <button
                        key={`${year}-${period.id}`}
                        onClick={() => handlePeriodSelect(period)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedPeriod.id === period.id && selectedPeriod.year === year
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>P{period.id}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {period.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {period.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-card rounded-xl border shadow-sm hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-sm">Budget Period</div>
            <div className="text-xs text-muted-foreground">{selectedPeriodShort}</div>
          </div>
        </div>
        <svg className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6,9 12,15 18,9"/>
        </svg>
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              {years.map(year => (
                <div key={year} className="mb-2">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 px-2 py-1 sticky top-0 bg-white dark:bg-gray-800">
                    {year}
                  </div>
                  {periodsByYear[year].map(period => (
                    <button
                      key={`${year}-${period.id}`}
                      onClick={() => handlePeriodSelect(period)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedPeriod.id === period.id && selectedPeriod.year === year
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Period {period.id}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {period.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {period.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Period navigation arrows for quick navigation
interface PeriodNavigationProps {
  selectedPeriod: { id: number; year: number; key: string };
  onPeriodChange: (period: { id: number; year: number; key: string }) => void;
}

export function PeriodNavigation({ selectedPeriod, onPeriodChange }: PeriodNavigationProps) {
  const handlePrevious = () => {
    if (selectedPeriod.id === 1) {
      // Go to period 12 of previous year
      onPeriodChange({ id: 12, year: selectedPeriod.year - 1, key: `${selectedPeriod.year - 1}-P12` });
    } else {
      onPeriodChange({ id: selectedPeriod.id - 1, year: selectedPeriod.year, key: `${selectedPeriod.year}-P${selectedPeriod.id - 1}` });
    }
  };

  const handleNext = () => {
    if (selectedPeriod.id === 12) {
      // Go to period 1 of next year
      onPeriodChange({ id: 1, year: selectedPeriod.year + 1, key: `${selectedPeriod.year + 1}-P1` });
    } else {
      onPeriodChange({ id: selectedPeriod.id + 1, year: selectedPeriod.year, key: `${selectedPeriod.year}-P${selectedPeriod.id + 1}` });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handlePrevious}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Previous period"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
      </button>
      <button
        onClick={handleNext}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Next period"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9,18 15,12 9,6"/>
        </svg>
      </button>
    </div>
  );
}
