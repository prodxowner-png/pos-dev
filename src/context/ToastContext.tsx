import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, RefreshCw, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  text: string;
  type: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' | 'HEALING';
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => string;
  removeToast: (id: string) => void;
  showSuccess: (title: string, text: string) => string;
  showError: (title: string, text: string) => string;
  showWarning: (title: string, text: string) => string;
  showInfo: (title: string, text: string) => string;
  showHealing: (title: string, text: string) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Math.random().toString(36).substring(2, 11)}`;
    const newToast: ToastMessage = {
      ...toast,
      id,
    };
    
    setToasts((prev) => [...prev, newToast]);

    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const showSuccess = useCallback((title: string, text: string) => {
    return addToast({ title, text, type: 'SUCCESS' });
  }, [addToast]);

  const showError = useCallback((title: string, text: string) => {
    return addToast({ title, text, type: 'ERROR' });
  }, [addToast]);

  const showWarning = useCallback((title: string, text: string) => {
    return addToast({ title, text, type: 'WARNING' });
  }, [addToast]);

  const showInfo = useCallback((title: string, text: string) => {
    return addToast({ title, text, type: 'INFO' });
  }, [addToast]);

  const showHealing = useCallback((title: string, text: string) => {
    return addToast({ title, text, type: 'HEALING', duration: 6000 });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, showSuccess, showError, showWarning, showInfo, showHealing }}>
      {children}
      
      {/* Toast Portal Container */}
      <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            let icon = <Info className="w-5 h-5 shrink-0" />;
            let styles = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.1)]";
            let iconWrapperStyles = "bg-slate-100 dark:bg-slate-800 text-slate-500";
            let glowStyles = "shadow-[0_0_20px_rgba(148,163,184,0.15)]";

            if (t.type === 'SUCCESS') {
              icon = <CheckCircle2 className="w-5 h-5 shrink-0" />;
              styles = "bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-900 text-slate-900 dark:text-slate-100";
              iconWrapperStyles = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400";
              glowStyles = "shadow-[0_0_25px_rgba(16,185,129,0.2)] dark:shadow-[0_0_30px_rgba(16,185,129,0.15)]";
            } else if (t.type === 'ERROR') {
              icon = <AlertCircle className="w-5 h-5 shrink-0" />;
              styles = "bg-white dark:bg-slate-900 border-rose-200 dark:border-rose-900 text-slate-900 dark:text-slate-100";
              iconWrapperStyles = "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400";
              glowStyles = "shadow-[0_0_25px_rgba(244,63,94,0.2)] dark:shadow-[0_0_30px_rgba(244,63,94,0.15)]";
            } else if (t.type === 'WARNING') {
              icon = <AlertTriangle className="w-5 h-5 shrink-0" />;
              styles = "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900 text-slate-900 dark:text-slate-100";
              iconWrapperStyles = "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400";
              glowStyles = "shadow-[0_0_25px_rgba(245,158,11,0.2)]";
            } else if (t.type === 'HEALING') {
              icon = <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />;
              styles = "bg-white dark:bg-slate-900 border-cyan-200 dark:border-cyan-900 text-slate-900 dark:text-slate-100";
              iconWrapperStyles = "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400";
              glowStyles = "shadow-[0_0_35px_rgba(6,182,212,0.3)] dark:shadow-[0_0_40px_rgba(6,182,212,0.25)] border-2 border-cyan-500/30";
            }

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                className={`pointer-events-auto flex items-start gap-3.5 p-4 rounded-2xl border ${styles} ${glowStyles} transition-all duration-300`}
              >
                <div className={`p-2.5 rounded-xl shrink-0 ${iconWrapperStyles}`}>
                  {icon}
                </div>
                
                <div className="flex-1 min-w-0 py-0.5">
                  <h5 className="text-xs font-bold tracking-tight uppercase text-slate-900 dark:text-slate-100">
                    {t.title}
                  </h5>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-normal [text-wrap:balance]">
                    {t.text}
                  </p>
                </div>

                <button
                  onClick={() => removeToast(t.id)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
