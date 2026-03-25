'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuthScreenProps {
  hasPin: boolean;
  storedPin: string | null;
  biometricEnabled: boolean;
  onVerified: () => void;
  onSetPin: (pin: string) => Promise<void>;
  onResetApp: () => Promise<void>;
}

export function AuthScreen({ hasPin, storedPin, biometricEnabled, onVerified, onSetPin, onResetApp }: AuthScreenProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricChecked, setBiometricChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Biometric authentication function - defined first with useCallback
  const handleBiometric = useCallback(async () => {
    if (typeof window === 'undefined') return;
    
    try {
      const credentialId = localStorage.getItem('biometric_credential_id');
      
      if (credentialId) {
        // Authenticate with existing credential
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: new Uint8Array(32),
            allowCredentials: [{
              id: Uint8Array.from(atob(credentialId), c => c.charCodeAt(0)),
              type: 'public-key',
            }],
            userVerification: 'required',
            timeout: 60000,
          },
        } as CredentialRequestOptions);
        
        if (credential) {
          onVerified();
          return;
        }
      }
      
      // No credential stored, register new one
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new Uint8Array(32),
          rp: { 
            name: 'Techmari Budget', 
            id: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname 
          },
          user: {
            id: new Uint8Array(16).fill(1),
            name: 'user@techmari',
            displayName: 'User',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },   // ES256
            { type: 'public-key', alg: -257 }  // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      } as CredentialCreationOptions);
      
      if (credential && credential instanceof PublicKeyCredential) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        localStorage.setItem('biometric_credential_id', credId);
        onVerified();
      }
    } catch (error: unknown) {
      console.error('Biometric error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      if (errorMessage.includes('NotAllowed') || errorMessage.includes('cancelled')) {
        setPinError('');
      } else {
        setPinError('Biometric failed. Please use PIN.');
      }
    }
  }, [onVerified]);

  // Check biometric support on mount
  useEffect(() => {
    const checkBiometric = async () => {
      if (typeof window !== 'undefined') {
        const hasPublicKeyCredential = 'PublicKeyCredential' in window;
        if (hasPublicKeyCredential) {
          try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            setBiometricSupported(available);
          } catch {
            setBiometricSupported(false);
          }
        }
      }
      setBiometricChecked(true);
    };
    checkBiometric();
  }, []);

  // Auto-trigger biometric on mount if enabled
  useEffect(() => {
    if (biometricChecked && hasPin && biometricEnabled && biometricSupported) {
      const timer = setTimeout(() => {
        handleBiometric();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [biometricChecked, hasPin, biometricEnabled, biometricSupported, handleBiometric]);

  const handlePinInput = useCallback((digit: string | number) => {
    setPinError('');
    const currentPin = showConfirmPin ? confirmPin : pin;

    if (digit === 'clear') {
      if (showConfirmPin) {
        setConfirmPin('');
      } else {
        setPin('');
      }
      return;
    }
    
    if (digit === 'back') {
      if (showConfirmPin) {
        setConfirmPin(prev => prev.slice(0, -1));
      } else {
        setPin(prev => prev.slice(0, -1));
      }
      return;
    }
    
    if (currentPin.length < 4) {
      const newPin = currentPin + String(digit);
      
      if (showConfirmPin) {
        setConfirmPin(newPin);
      } else {
        setPin(newPin);
      }

      if (newPin.length === 4) {
        setTimeout(async () => {
          if (!hasPin) {
            // Setting up new PIN
            if (!showConfirmPin) {
              // First PIN entry - store and ask for confirmation
              setTempPin(newPin);
              setShowConfirmPin(true);
              setPin('');
            } else {
              // Confirming PIN
              if (newPin === tempPin) {
                try {
                  await onSetPin(newPin);
                  onVerified();
                } catch (error) {
                  setPinError('Failed to save PIN. Please try again.');
                  setConfirmPin('');
                  setShowConfirmPin(false);
                  setTempPin('');
                }
              } else {
                setPinError('PINs do not match. Try again.');
                setConfirmPin('');
                setShowConfirmPin(false);
                setTempPin('');
              }
            }
          } else {
            // Verifying existing PIN
            if (newPin === storedPin) {
              onVerified();
            } else {
              setPinError('Incorrect PIN');
              setPin('');
            }
          }
        }, 150);
      }
    }
  }, [pin, confirmPin, showConfirmPin, hasPin, storedPin, tempPin, onSetPin, onVerified]);

  const displayPin = showConfirmPin ? confirmPin : pin;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl w-full max-w-sm text-center shadow-2xl">
        {/* Lock Icon */}
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">
          {!hasPin ? (showConfirmPin ? 'Confirm PIN' : 'Set PIN') : 'Welcome Back'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {!hasPin 
            ? (showConfirmPin ? 'Enter your PIN again to confirm' : 'Create a 4-digit PIN to secure your app')
            : 'Enter your PIN to continue'}
        </p>

        {/* PIN Dots */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                i < displayPin.length 
                  ? 'bg-blue-600 scale-110' 
                  : 'bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {pinError && (
          <p className="text-red-500 text-sm mb-4">{pinError}</p>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <button
              key={d}
              onClick={() => handlePinInput(d)}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                         rounded-full aspect-square text-2xl font-semibold transition-all 
                         active:scale-95 text-slate-800 dark:text-white"
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => handlePinInput('clear')}
            className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                       rounded-full aspect-square text-sm font-semibold transition-all 
                       active:scale-95 text-slate-500 dark:text-slate-300"
          >
            Clear
          </button>
          <button
            onClick={() => handlePinInput(0)}
            className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                       rounded-full aspect-square text-2xl font-semibold transition-all 
                       active:scale-95 text-slate-800 dark:text-white"
          >
            0
          </button>
          <button
            onClick={() => handlePinInput('back')}
            className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 
                       rounded-full aspect-square text-xl font-semibold transition-all 
                       active:scale-95 text-slate-500 dark:text-slate-300"
          >
            ⌫
          </button>
        </div>

        {/* Biometric Button */}
        {hasPin && biometricSupported && (
          <button
            onClick={handleBiometric}
            className="w-full flex items-center justify-center gap-3 py-4 mb-4 bg-gradient-to-r 
                       from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700
                       text-white font-semibold rounded-xl transition-all shadow-lg
                       active:scale-[0.98]"
          >
            {/* Fingerprint Icon */}
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.04-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.39 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.21.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.24 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/>
            </svg>
            Use Fingerprint / Face ID
          </button>
        )}

        {/* Device doesn't support biometrics message */}
        {hasPin && !biometricSupported && biometricChecked && (
          <div className="text-xs text-slate-400 dark:text-slate-500 mb-4 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Biometric not available on this device
          </div>
        )}

        {/* Forgot PIN */}
        {hasPin && (
          <button
            onClick={() => {
              if (confirm('This will reset all data including your PIN. Continue?')) {
                onResetApp();
              }
            }}
            className="text-sm text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            Forgot PIN? Reset App
          </button>
        )}

        {/* Back button when confirming PIN */}
        {!hasPin && showConfirmPin && (
          <button
            onClick={() => {
              setShowConfirmPin(false);
              setConfirmPin('');
              setTempPin('');
            }}
            className="mt-4 text-sm text-blue-600 dark:text-blue-400 font-medium"
          >
            ← Start Over
          </button>
        )}
      </div>
    </div>
  );
}
