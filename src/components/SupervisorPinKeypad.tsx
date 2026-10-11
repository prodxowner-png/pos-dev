import React, { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  Lock,
  Delete,
  CheckCircle2,
  AlertCircle,
  X,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';

export interface SupervisorPinKeypadProps {
  onPinSubmit: (pin: string) => void | Promise<void>;
  onCancel?: () => void;
  isVerifying?: boolean;
  errorMessage?: string | null;
  title?: string;
  subtitle?: string;
  autoSubmitLength?: number; // default 4
  isFloating?: boolean;
  onToggleFloating?: () => void;
  className?: string;
  supervisorNameHint?: string;
}

export const SupervisorPinKeypad: React.FC<SupervisorPinKeypadProps> = ({
  onPinSubmit,
  onCancel,
  isVerifying = false,
  errorMessage = null,
  title = 'Supervisor Refund PIN Authorization',
  subtitle = 'High-contrast touch keypad for rapid shift supervisor authorization',
  autoSubmitLength = 4,
  isFloating = false,
  onToggleFloating,
  className = '',
  supervisorNameHint,
}) => {
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [shake, setShake] = useState<boolean>(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Play subtle touch click sound
  const playClickSound = useCallback((type: 'digit' | 'backspace' | 'submit' | 'error' = 'digit') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'digit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.04);
      } else if (type === 'backspace') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.18);
      } else if (type === 'submit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.06); // E5
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
      }
    } catch {
      // AudioContext fallback
    }
  }, [soundEnabled]);

  // Handle key press
  const handlePressKey = useCallback((val: string) => {
    setActiveKey(val);
    setTimeout(() => setActiveKey(null), 120);

    if (pin.length < 6) {
      const nextPin = pin + val;
      setPin(nextPin);
      playClickSound('digit');

      // Auto-submit if exact length reached
      if (nextPin.length === autoSubmitLength && !isVerifying) {
        playClickSound('submit');
        onPinSubmit(nextPin);
      }
    }
  }, [pin, autoSubmitLength, isVerifying, onPinSubmit, playClickSound]);

  const handleBackspace = useCallback(() => {
    if (pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
      playClickSound('backspace');
    }
  }, [pin.length, playClickSound]);

  const handleClear = useCallback(() => {
    setPin('');
    playClickSound('backspace');
  }, [playClickSound]);

  const handleSubmit = useCallback(() => {
    if (pin.length >= 4 && !isVerifying) {
      playClickSound('submit');
      onPinSubmit(pin);
    } else {
      setShake(true);
      playClickSound('error');
      setTimeout(() => setShake(false), 400);
    }
  }, [pin, isVerifying, onPinSubmit, playClickSound]);

  // Trigger shake on external error message
  useEffect(() => {
    if (errorMessage) {
      setShake(true);
      playClickSound('error');
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, playClickSound]);

  // Hardware keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isVerifying) return;
      if (e.key >= '0' && e.key <= '9') {
        handlePressKey(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        if (onCancel) onCancel();
      } else if (e.key === 'Enter') {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePressKey, handleBackspace, handleSubmit, onCancel, isVerifying]);

  // Quick Supervisor Presets
  const handleQuickPreset = (presetPin: string) => {
    setPin(presetPin);
    playClickSound('submit');
    onPinSubmit(presetPin);
  };

  return (
    <div
      className={`relative select-none transition-all duration-200 ${
        isFloating
          ? 'fixed bottom-6 right-6 z-50 w-80 shadow-2xl rounded-3xl border-2 border-amber-500/50 bg-slate-950/95 backdrop-blur-xl text-white p-5 animate-in slide-in-from-bottom-5'
          : 'w-full max-w-sm mx-auto bg-slate-950 rounded-3xl border border-slate-800 p-5 shadow-2xl text-white'
      } ${shake ? 'animate-shake' : ''} ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-xs tracking-wider uppercase text-amber-400">
                {title}
              </h3>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRODX
              </span>
            </div>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Disable audio touch chimes' : 'Enable audio touch chimes'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
          {onToggleFloating && (
            <button
              type="button"
              onClick={onToggleFloating}
              title={isFloating ? 'Dock in modal' : 'Float to side panel'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              {isFloating ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* PIN Display Field */}
      <div className="space-y-2 mb-4">
        <div className="relative flex items-center justify-between px-4 py-3.5 bg-slate-900/90 border-2 border-slate-800 focus-within:border-amber-500/80 rounded-2xl transition-all shadow-inner">
          <div className="flex items-center gap-2">
            <Lock className={`w-4 h-4 ${pin.length >= 4 ? 'text-emerald-400' : 'text-amber-400/70'}`} />
            {supervisorNameHint && (
              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[100px]">
                {supervisorNameHint}
              </span>
            )}
          </div>

          {/* Masked Dots or Visible Numbers */}
          <div className="flex items-center justify-center gap-2 font-mono font-extrabold text-xl tracking-widest my-auto text-amber-300">
            {[0, 1, 2, 3].map((idx) => {
              const char = pin[idx];
              const isFilled = char !== undefined;
              return (
                <div
                  key={idx}
                  className={`w-7 h-9 rounded-xl flex items-center justify-center border-2 transition-all duration-150 ${
                    isFilled
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                      : 'bg-slate-950/60 border-slate-800 text-slate-600'
                  }`}
                >
                  {isFilled ? (showPin ? char : '●') : ''}
                </div>
              );
            })}
          </div>

          {/* Toggle PIN visibility */}
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="p-1.5 text-slate-400 hover:text-amber-300 transition-colors"
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="font-semibold text-[11px]">{errorMessage}</span>
          </div>
        )}
      </div>

      {/* High-Contrast Touch Keypad Grid */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { key: '1', sub: '' },
          { key: '2', sub: 'ABC' },
          { key: '3', sub: 'DEF' },
          { key: '4', sub: 'GHI' },
          { key: '5', sub: 'JKL' },
          { key: '6', sub: 'MNO' },
          { key: '7', sub: 'PQRS' },
          { key: '8', sub: 'TUV' },
          { key: '9', sub: 'WXYZ' },
        ].map(({ key, sub }) => (
          <button
            key={key}
            type="button"
            disabled={isVerifying}
            onClick={() => handlePressKey(key)}
            className={`group relative h-14 rounded-2xl font-mono font-extrabold text-xl flex flex-col items-center justify-center transition-all duration-100 cursor-pointer active:scale-95 touch-manipulation ${
              activeKey === key
                ? 'bg-amber-400 text-slate-950 scale-95 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-amber-500/40 shadow-sm'
            }`}
          >
            <span>{key}</span>
            {sub && <span className="text-[8px] font-sans font-medium text-slate-500 group-hover:text-slate-400 -mt-1">{sub}</span>}
          </button>
        ))}

        {/* Bottom row: Clear, 0, Backspace */}
        <button
          type="button"
          disabled={isVerifying || pin.length === 0}
          onClick={handleClear}
          className="h-14 rounded-2xl font-sans font-black text-xs uppercase tracking-wider text-slate-400 bg-slate-900/60 hover:bg-rose-500/20 hover:text-rose-300 border border-slate-800 transition-all flex items-center justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          Clear
        </button>

        <button
          type="button"
          disabled={isVerifying}
          onClick={() => handlePressKey('0')}
          className={`h-14 rounded-2xl font-mono font-extrabold text-xl flex items-center justify-center transition-all duration-100 cursor-pointer active:scale-95 touch-manipulation ${
            activeKey === '0'
              ? 'bg-amber-400 text-slate-950 scale-95 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-800 hover:border-amber-500/40 shadow-sm'
          }`}
        >
          0
        </button>

        <button
          type="button"
          disabled={isVerifying || pin.length === 0}
          onClick={handleBackspace}
          className="h-14 rounded-2xl text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 transition-all flex items-center justify-center active:scale-95 disabled:opacity-30 cursor-pointer"
        >
          <Delete className="w-5 h-5 text-amber-400" />
        </button>
      </div>

      {/* Quick Supervisor PIN Presets Bar */}
      <div className="bg-slate-900/70 rounded-2xl p-2.5 border border-slate-800 mb-4 space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
          <span className="flex items-center gap-1">
            <UserCheck className="w-3 h-3 text-amber-400" />
            Quick Authorized PINs:
          </span>
          <span className="text-[9px] text-amber-400 font-mono">1-Tap Override</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => handleQuickPreset('2580')}
            className="px-2 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold transition-all text-center"
          >
            2580 <span className="block text-[8px] font-sans font-normal text-slate-400">Shift Sup</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('1234')}
            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-mono font-bold transition-all text-center"
          >
            1234 <span className="block text-[8px] font-sans font-normal text-slate-400">Asst Mgr</span>
          </button>
          <button
            type="button"
            onClick={() => handleQuickPreset('9999')}
            className="px-2 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-mono font-bold transition-all text-center"
          >
            9999 <span className="block text-[8px] font-sans font-normal text-slate-400">Store Mgr</span>
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        disabled={isVerifying || pin.length < 4}
        onClick={handleSubmit}
        className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider active:scale-98"
      >
        <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
        <span>{isVerifying ? 'Authenticating Supervisor...' : 'Authorize Refund / Override'}</span>
      </button>
    </div>
  );
};
