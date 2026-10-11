import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Tv,
  Cast,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Maximize2,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  Copy,
  ChevronRight,
} from 'lucide-react';
import { presentationService } from '../services/presentationService';
import { CustomerFacingDisplay } from './CustomerFacingDisplay';
import { useToast } from '../context/ToastContext';

interface CustomerDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerDisplayModal: React.FC<CustomerDisplayModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showSuccess, showInfo, showError } = useToast();
  const [isConnected, setIsConnected] = useState<boolean>(presentationService.isConnected());
  const [isApiSupported, setIsApiSupported] = useState<boolean>(
    presentationService.isPresentationApiSupported()
  );
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'CONTROLS' | 'PREVIEW'>('CONTROLS');

  useEffect(() => {
    if (!isOpen) return;
    const unsub = presentationService.onConnectionChange((connected) => {
      setIsConnected(connected);
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartPresentation = async () => {
    setIsLaunching(true);
    try {
      await presentationService.startPresentation();
      showSuccess('Presentation API Connected', 'Customer-Facing Display dispatched to secondary screen.');
    } catch (err: any) {
      showError('Presentation Error', err.message || 'Could not launch secondary presentation display');
    } finally {
      setIsLaunching(false);
    }
  };

  const handleOpenSecondaryWindow = () => {
    presentationService.openSecondaryWindow();
    showSuccess('Secondary Monitor Opened', 'Customer display window opened. Move to customer-facing screen and press F11 for fullscreen.');
  };

  const handleCopyUrl = () => {
    const url = presentationService.getPresentationTargetUrl();
    navigator.clipboard?.writeText(url);
    showInfo('URL Copied', 'Customer display receiver URL copied to clipboard.');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`w-full ${
            viewMode === 'PREVIEW' ? 'max-w-6xl h-[85vh]' : 'max-w-xl'
          } flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden transition-all duration-300`}
        >
          {/* Header */}
          <div className="p-6 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Tv className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Customer-Facing Display (CFD)</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      isConnected
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    {isConnected ? 'Connected' : 'Ready to Connect'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Secondary Monitor • W3C Presentation API &amp; Real-time Broadcast
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('CONTROLS')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'CONTROLS'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Controls
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('PREVIEW')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    viewMode === 'PREVIEW'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Live Mirror</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Content */}
          {viewMode === 'PREVIEW' ? (
            <div className="flex-1 overflow-hidden relative bg-black flex flex-col">
              <div className="p-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 px-4">
                <span className="font-mono text-[11px]">
                  Real-time Customer Monitor Simulation View
                </span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Mirroring Cashier Cart
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <CustomerFacingDisplay isStandalone={false} />
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-widest block">
                    Live Cart Mirroring
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    0ms Latency
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Itemized prices, quantities, taxes, and promotional discounts.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-widest block">
                    Promotional Media
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Auto Carousel
                  </div>
                  <p className="text-[11px] text-slate-500">
                    High-res banners, seasonal discounts, and VIP loyalty rewards.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-widest block">
                    PromptPay QR &amp; NFC
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    EMVCo QR
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Dynamic QR code links with live scan timer and change due.
                  </p>
                </div>
              </div>

              {/* Launcher Actions */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Secondary Monitor Launch Options
                </label>

                {/* Option 1: Standard W3C Presentation API */}
                <button
                  type="button"
                  onClick={handleStartPresentation}
                  disabled={isLaunching}
                  className="w-full p-4 rounded-2xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-500/10 text-left flex items-center justify-between gap-4 transition-all group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                      <Cast className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>Launch via W3C Presentation API</span>
                        <span className="text-[10px] px-2 py-0.2 rounded font-mono bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                          Recommended
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Dispatches native secondary screen receiver via Chrome / OS dual display
                      </div>
                    </div>
                  </div>
                  <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                </button>

                {/* Option 2: Extended Monitor Window Popup */}
                <button
                  type="button"
                  onClick={handleOpenSecondaryWindow}
                  className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 hover:bg-slate-100 dark:hover:bg-slate-800/60 text-left flex items-center justify-between gap-4 transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        Open Extended Window on Secondary Screen
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Launches secondary screen popup synced via BroadcastChannel &amp; storage
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* URL & Receiver Link */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs font-mono">
                <div className="truncate text-slate-600 dark:text-slate-400">
                  Target: {presentationService.getPresentationTargetUrl()}
                </div>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              Updates in real time automatically as the cashier scans items.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
