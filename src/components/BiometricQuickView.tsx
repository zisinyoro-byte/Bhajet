'use client';

import { useState, useEffect, useCallback } from 'react';

interface QuickViewProps {
  balance: number;
  currency: string;
  onFullUnlock: () => void;
  onClose: () => void;
}

export function BiometricQuickView({ balance, currency, onFullUnlock, onClose }: QuickViewProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [showBalance, setShowBalance] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10);

  const formatCurrency = (amount: number) => {
    const symbols: Record<string, string> = {
      USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹',
    };
    const symbol = symbols[currency] || '$';
    return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleQuickView = useCallback(async () => {
    setIsVerifying(true);
    setError('');

    try {
      // Check if WebAuthn is available
      if (!window.PublicKeyCredential) {
        setError('Biometric not supported');
        return;
      }

      const credentialId = localStorage.getItem('biometric_credential_id');
      
      if (!credentialId) {
        setError('Please enable biometric first');
        return;
      }

      // Quick biometric verification
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new Uint8Array(32),
          allowCredentials: [{
            id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
            type: 'public-key',
          }],
          userVerification: 'required',
          timeout: 30000,
        },
      } as CredentialRequestOptions);

      if (credential) {
        setShowBalance(true);
        setTimeLeft(10);
        
        // Haptic feedback
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
      }
    } catch (err) {
      console.error('Quick view error:', err);
      const errorMessage = err instanceof Error ? err.message : '';
      if (!errorMessage.includes('NotAllowed') && !errorMessage.includes('cancelled')) {
        setError('Verification failed');
      }
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Auto-close timer
  useEffect(() => {
    if (showBalance && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (showBalance && timeLeft === 0) {
      onClose();
    }
  }, [showBalance, timeLeft, onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-6 w-full max-w-sm text-white text-center shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.81 2.13-1.88 0-1.09-.75-1.72-2.89-2.24-2.05-.5-4.21-1.29-4.21-3.71 0-1.92 1.48-3.03 3.12-3.4V4h2.67v1.93c1.61.32 2.89 1.44 3.03 3.23h-1.97c-.1-.94-1.01-1.64-2.25-1.64-1.25 0-2.01.76-2.01 1.64 0 1.03.87 1.64 2.74 2.09 2.4.56 4.35 1.35 4.35 3.85 0 1.98-1.54 3.14-3.26 3.49z"/>
            </svg>
            <span className="font-bold">Techmari Budget</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick View Title */}
        <div className="text-sm opacity-80 mb-2">Quick Balance View</div>

        {error && (
          <div className="bg-red-500/20 text-red-200 p-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {/* Balance Display */}
        <div className="bg-white/10 rounded-2xl p-6 mb-4">
          {showBalance ? (
            <div className="animate-fadeIn">
              <div className="text-sm opacity-80 mb-1">Total Balance</div>
              <div className="text-3xl font-extrabold tracking-tight">
                {formatCurrency(balance)}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs opacity-70">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
                Auto-hiding in {timeLeft}s
              </div>
            </div>
          ) : (
            <div className="text-2xl font-bold opacity-50">
              ••••••
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {!showBalance && (
            <button
              onClick={handleQuickView}
              disabled={isVerifying}
              className="w-full flex items-center justify-center gap-2 py-4 bg-white text-blue-600 
                         font-semibold rounded-xl transition-all active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? (
                <>
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/>
                  </svg>
                  Show Balance with Biometric
                </>
              )}
            </button>
          )}

          <button
            onClick={onFullUnlock}
            className="w-full py-3 text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Unlock Full App →
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-4 text-xs opacity-60 flex items-center justify-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
          </svg>
          Balance hides automatically for security
        </div>
      </div>
    </div>
  );
}

// Hook to check if quick view is available
export function useQuickViewAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hasBiometricCredential = !!localStorage.getItem('biometric_credential_id');
  const hasPublicKeyCredential = 'PublicKeyCredential' in window;
  
  return hasBiometricCredential && hasPublicKeyCredential;
}
