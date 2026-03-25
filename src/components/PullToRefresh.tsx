'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const threshold = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    // Only handle pull down
    if (diff > 0 && container.scrollTop <= 0) {
      // Apply resistance
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, 150);
      setPullDistance(distance);
      
      // Prevent scroll while pulling
      if (diff > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, disabled, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    
    setIsPulling(false);
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      }
      
      // Add a small delay for better UX
      setTimeout(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      }, 300);
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh, disabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (disabled || isRefreshing) return;
      
      if (container.scrollTop <= 0 && e.deltaY < 0) {
        // Scrolling up at top - could trigger refresh
        // For now, we only support touch
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [disabled, isRefreshing]);

  const progress = Math.min(pullDistance / threshold, 1);
  const showSpinner = isRefreshing || pullDistance >= threshold;

  return (
    <div className="relative h-full overflow-hidden">
      {/* Pull indicator */}
      <div 
        className="absolute left-0 right-0 flex justify-center items-center transition-all duration-200 z-10"
        style={{ 
          top: pullDistance > 0 ? `${Math.min(pullDistance - 40, 40)}px` : '-40px',
          opacity: pullDistance > 0 ? Math.min(progress * 1.5, 1) : 0,
        }}
      >
        {showSpinner ? (
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
            <svg 
              className="w-5 h-5 text-white animate-spin" 
              viewBox="0 0 24 24" 
              fill="none"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        ) : (
          <div 
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shadow-md transition-transform"
            style={{ transform: `rotate(${progress * 360}deg)` }}
          >
            <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        style={{ 
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
