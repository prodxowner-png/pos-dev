import React, { useEffect, useState, useRef } from 'react';

interface AnimatedMetricValueProps {
  value: number;
  formatter?: (val: number) => string;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  showHighlightOnUpdate?: boolean;
}

export const AnimatedMetricValue: React.FC<AnimatedMetricValueProps> = ({
  value,
  formatter,
  decimals = 0,
  duration = 900,
  className = '',
  prefix,
  suffix,
  showHighlightOnUpdate = true,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [deltaType, setDeltaType] = useState<'UP' | 'DOWN' | null>(null);

  const startValueRef = useRef<number>(value);
  const targetValueRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If initial mount or value unchanged, set target
    if (value === targetValueRef.current) return;

    const diff = value - targetValueRef.current;
    if (diff > 0) {
      setDeltaType('UP');
    } else if (diff < 0) {
      setDeltaType('DOWN');
    }

    if (showHighlightOnUpdate) {
      setIsUpdating(true);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setIsUpdating(false);
        setDeltaType(null);
      }, 1200);
    }

    startValueRef.current = displayValue;
    targetValueRef.current = value;
    startTimeRef.current = null;

    const animateCount = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Ease Out Cubic: 1 - Math.pow(1 - progress, 3)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = startValueRef.current + (targetValueRef.current - startValueRef.current) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateCount);
      } else {
        setDisplayValue(targetValueRef.current);
      }
    };

    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(animateCount);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, [value, duration, showHighlightOnUpdate]);

  const formattedStr = formatter
    ? formatter(displayValue)
    : displayValue.toLocaleString('th-TH', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <span
      className={`inline-flex items-baseline gap-1 transition-all duration-300 relative ${
        isUpdating
          ? deltaType === 'UP'
            ? 'text-emerald-500 dark:text-emerald-400 scale-[1.03] drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]'
            : 'text-amber-500 dark:text-amber-400 scale-[1.03]'
          : ''
      } ${className}`}
    >
      {prefix}
      <span className="tabular-nums font-mono transition-transform duration-100">{formattedStr}</span>
      {suffix}
      {isUpdating && (
        <span
          className={`absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full animate-ping ${
            deltaType === 'UP' ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      )}
    </span>
  );
};
