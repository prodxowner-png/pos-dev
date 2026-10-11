import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  BellRing,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Check,
  Trash2,
  ExternalLink,
  Zap,
  ServerCrash,
  ShieldCheck,
  Activity,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  SystemNotification,
  NotificationSeverity,
  NotificationCategory,
  NotificationFeedResponse,
} from '../types/prodx';

interface NotificationBellProps {
  theme: 'light' | 'dark';
  onNavigateModule?: (
    module: 'POS' | 'INVENTORY' | 'CUSTOMER_DISPLAY' | 'KDS' | 'MIGRATIONS' | 'BACKEND_CONNECT' | 'DOCKER_CICD' | 'COST_ESTIMATOR' | 'TELEMETRY' | 'SECURITY'
  ) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  theme,
  onNavigateModule,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [serverStatus, setServerStatus] = useState<'OPERATIONAL' | 'DEGRADED' | 'DOWNTIME'>('OPERATIONAL');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'SECURITY' | 'SYSTEM'>('ALL');
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeToast, setActiveToast] = useState<SystemNotification | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCriticalCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  // Fetch notifications feed from server
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data: NotificationFeedResponse = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setCriticalCount(data.criticalCount || 0);
        setServerStatus(data.serverStatus?.status || 'OPERATIONAL');

        // Check if a new critical alert has arrived
        if (!isFirstLoadRef.current && (data.criticalCount || 0) > prevCriticalCountRef.current) {
          const newestCritical = (data.notifications || []).find(
            n => n.severity === 'CRITICAL' && !n.read
          );
          if (newestCritical) {
            setActiveToast(newestCritical);
          }
        }
        prevCriticalCountRef.current = data.criticalCount || 0;
        isFirstLoadRef.current = false;
      } else {
        // HTTP error from server (e.g. 502, 503, 500)
        setServerStatus('DOWNTIME');
      }
    } catch {
      // Network disconnect / Server unreachable
      setServerStatus('DOWNTIME');
      // Inject synthetic offline alert if not already present
      setNotifications(prev => {
        const hasOfflineNotif = prev.some(n => n.id === 'offline-local-sentinel' && !n.resolved);
        if (!hasOfflineNotif) {
          const localDowntimeAlert: SystemNotification = {
            id: 'offline-local-sentinel',
            title: '🔴 Critical: Server Unreachable / Gateway Downtime',
            message: 'Client cannot connect to PRODX API server (connection refused or timeout). POS operating in offline fallback mode.',
            severity: 'CRITICAL',
            category: 'SERVER_DOWNTIME',
            createdAt: new Date().toISOString(),
            read: false,
            actionLink: { module: 'BACKEND_CONNECT', label: 'Inspect Network' },
            resolved: false,
          };
          return [localDowntimeAlert, ...prev];
        }
        return prev;
      });
      setCriticalCount(prev => Math.max(prev, 1));
      setUnreadCount(prev => Math.max(prev, 1));
    }
  }, []);

  // Initial fetch and periodic polling (every 4s)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Dismiss toast after 7 seconds
  useEffect(() => {
    if (activeToast) {
      const timer = setTimeout(() => {
        setActiveToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [activeToast]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Mark single notification as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        const item = notifications.find(n => n.id === id);
        if (item?.severity === 'CRITICAL') {
          setCriticalCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch {
      // Local fallback
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      setCriticalCount(0);
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      setCriticalCount(0);
    }
  };

  // Clear notifications
  const handleClear = async (onlyRead: boolean) => {
    try {
      await fetch('/api/notifications/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyRead }),
      });
      if (onlyRead) {
        setNotifications(prev => prev.filter(n => !n.read));
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setCriticalCount(0);
      }
    } catch {
      if (onlyRead) {
        setNotifications(prev => prev.filter(n => !n.read));
      } else {
        setNotifications([]);
        setUnreadCount(0);
        setCriticalCount(0);
      }
    }
  };

  // Trigger simulation drill
  const handleTriggerSimulate = async (type: 'SECURITY_BREACH' | 'SERVER_DOWNTIME' | 'SYSTEM_RECOVERED') => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/notifications/simulate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.notification) {
          setNotifications(prev => [data.notification, ...prev]);
          setUnreadCount(data.unreadCount || unreadCount + 1);
          setCriticalCount(data.criticalCount || (data.notification.severity === 'CRITICAL' ? criticalCount + 1 : criticalCount));
          if (data.notification.severity === 'CRITICAL') {
            setActiveToast(data.notification);
          }
        }
        await fetchNotifications();
      }
    } catch {
      // Ignore
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered notifications
  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'CRITICAL') return n.severity === 'CRITICAL';
    if (activeFilter === 'SECURITY') {
      return (
        n.category === 'SECURITY_BREACH' ||
        n.category === 'AUTHORIZATION_VIOLATION'
      );
    }
    if (activeFilter === 'SYSTEM') {
      return (
        n.category === 'SERVER_DOWNTIME' ||
        n.category === 'DATABASE_LATENCY' ||
        n.category === 'SYSTEM_HEALTH'
      );
    }
    return true;
  });

  const hasCriticalUnread = criticalCount > 0;

  // Format relative timestamp
  const formatTimeAgo = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 45) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Top Header Bell Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative p-2 rounded-lg transition-all border shadow-sm flex items-center justify-center cursor-pointer ${
          hasCriticalUnread
            ? 'bg-rose-500/10 border-rose-500/40 text-rose-500 hover:bg-rose-500/20'
            : theme === 'dark'
            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
        }`}
        title={`System Notifications (${unreadCount} unread${hasCriticalUnread ? ` • ${criticalCount} CRITICAL ALERTS` : ''})`}
        aria-label="System Notifications"
      >
        {hasCriticalUnread ? (
          <BellRing className="w-4 h-4 text-rose-500 animate-[wiggle_1s_ease-in-out_infinite]" />
        ) : (
          <Bell className="w-4 h-4" />
        )}

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center">
            {hasCriticalUnread && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full text-[10px] font-black leading-none text-white px-1 py-0.5 shadow-sm ${
                hasCriticalUnread ? 'bg-rose-600' : 'bg-amber-500'
              }`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Popover Notification Center */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={`absolute right-0 mt-2 w-[390px] sm:w-[440px] max-w-[92vw] max-h-[85vh] rounded-2xl shadow-2xl border flex flex-col z-50 overflow-hidden backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-slate-950/80'
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-400/20'
            }`}
          >
            {/* Header Zone */}
            <div
              className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50/80'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    hasCriticalUnread
                      ? 'bg-rose-500/20 text-rose-500'
                      : 'bg-indigo-500/10 text-indigo-500'
                  }`}
                >
                  {hasCriticalUnread ? <ShieldAlert className="w-4 h-4" /> : <Activity className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight flex items-center gap-2">
                    <span>System Sentinel Alerts</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        serverStatus === 'OPERATIONAL'
                          ? 'text-emerald-500'
                          : serverStatus === 'DEGRADED'
                          ? 'text-amber-500'
                          : 'text-rose-500 animate-pulse font-bold'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          serverStatus === 'OPERATIONAL'
                            ? 'bg-emerald-500'
                            : serverStatus === 'DEGRADED'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                      />
                      {serverStatus === 'OPERATIONAL'
                        ? 'Server Operational'
                        : serverStatus === 'DEGRADED'
                        ? 'Latency Degraded'
                        : 'Server Downtime Detected'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Mark all as read"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Mark read</span>
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => handleClear(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
                    title="Clear read alerts"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick Simulation Drill Toolbar */}
            <div
              className={`px-4 py-2 border-b flex items-center justify-between gap-2 text-[11px] ${
                theme === 'dark' ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-100/60 border-slate-200/60'
              }`}
            >
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Test Drills:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => handleTriggerSimulate('SECURITY_BREACH')}
                  disabled={isSimulating}
                  className="px-2 py-1 rounded bg-rose-500/15 text-rose-500 hover:bg-rose-500/25 font-bold transition-all disabled:opacity-50 whitespace-nowrap active:scale-95 flex items-center gap-1"
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>Security Breach</span>
                </button>
                <button
                  onClick={() => handleTriggerSimulate('SERVER_DOWNTIME')}
                  disabled={isSimulating}
                  className="px-2 py-1 rounded bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 font-bold transition-all disabled:opacity-50 whitespace-nowrap active:scale-95 flex items-center gap-1"
                >
                  <ServerCrash className="w-3 h-3" />
                  <span>Server Downtime</span>
                </button>
                <button
                  onClick={() => handleTriggerSimulate('SYSTEM_RECOVERED')}
                  disabled={isSimulating}
                  className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-bold transition-all disabled:opacity-50 whitespace-nowrap active:scale-95 flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Recover</span>
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 pt-2.5 pb-1 flex items-center gap-1.5 border-b border-slate-200/60 dark:border-slate-800">
              {[
                { id: 'ALL', label: 'All', count: notifications.length },
                { id: 'CRITICAL', label: 'Critical', count: criticalCount, isDanger: criticalCount > 0 },
                { id: 'SECURITY', label: 'Security' },
                { id: 'SYSTEM', label: 'Server / Health' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeFilter === tab.id
                      ? theme === 'dark'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-200/90 text-slate-900'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        tab.isDanger
                          ? 'bg-rose-500 text-white'
                          : 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Notification List Scroll Zone */}
            <div className="overflow-y-auto flex-1 p-3 space-y-2.5 max-h-[460px] divide-y-0">
              {filteredNotifications.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    All Systems Operational & Secure
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
                    No unresolved security breaches, auth lockouts, or server downtime incidents detected.
                  </p>
                </div>
              ) : (
                filteredNotifications.map(item => {
                  const isCritical = item.severity === 'CRITICAL';
                  const isWarning = item.severity === 'WARNING';

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleMarkAsRead(item.id)}
                      className={`relative p-3 rounded-xl border transition-all cursor-pointer group ${
                        !item.read
                          ? isCritical
                            ? theme === 'dark'
                              ? 'bg-rose-950/25 border-rose-800/80 shadow-sm shadow-rose-950/40'
                              : 'bg-rose-50/80 border-rose-300 shadow-sm shadow-rose-100'
                            : isWarning
                            ? theme === 'dark'
                              ? 'bg-amber-950/20 border-amber-800/60'
                              : 'bg-amber-50/80 border-amber-200'
                            : theme === 'dark'
                            ? 'bg-slate-800/40 border-slate-700/60'
                            : 'bg-slate-50 border-slate-200/80'
                          : theme === 'dark'
                          ? 'bg-slate-900/30 border-slate-800/60 opacity-75 hover:opacity-100'
                          : 'bg-white border-slate-200/60 opacity-75 hover:opacity-100'
                      }`}
                    >
                      {/* Left Severity Accent Line */}
                      <div
                        className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${
                          isCritical
                            ? 'bg-rose-500'
                            : isWarning
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />

                      <div className="pl-2">
                        {/* Title and Top Pill */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider ${
                                isCritical
                                  ? 'bg-rose-500/20 text-rose-500'
                                  : isWarning
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : 'bg-emerald-500/20 text-emerald-500'
                              }`}
                            >
                              {item.category.replace('_', ' ')}
                            </span>
                            {!item.read && (
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>

                        {/* Heading */}
                        <h4 className={`text-xs font-bold mt-1.5 ${
                          isCritical ? 'text-rose-500 dark:text-rose-400' : ''
                        }`}>
                          {item.title}
                        </h4>

                        {/* Message description */}
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                          {item.message}
                        </p>

                        {/* Metadata Tags & Action Trigger */}
                        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-200/40 dark:border-slate-800/60">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            {item.sourceIp && <span>IP: {item.sourceIp}</span>}
                            {item.actorId && <span>Actor: {item.actorId}</span>}
                          </div>

                          <div className="flex items-center gap-1.5">
                            {item.actionLink && onNavigateModule && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(item.id);
                                  onNavigateModule(item.actionLink!.module);
                                  setIsOpen(false);
                                }}
                                className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 transition-colors"
                              >
                                <span>{item.actionLink.label}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {!item.read && (
                              <button
                                onClick={(e) => handleMarkAsRead(item.id, e)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
                                title="Mark read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Zone */}
            <div
              className={`px-4 py-2.5 border-t text-[11px] flex items-center justify-between text-slate-400 ${
                theme === 'dark' ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50/90 border-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Audited via Cryptographic SHA-256 Ledger</span>
              </span>
              <button
                onClick={fetchNotifications}
                className="hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 transition-colors font-semibold"
                title="Poll now"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sync</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Critical Alert Toast Banner */}
      <AnimatePresence>
        {activeToast && !isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-16 right-6 z-50 max-w-md w-full p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-xl ${
              theme === 'dark'
                ? 'bg-rose-950/95 border-rose-800 text-white shadow-rose-950/50'
                : 'bg-white border-rose-300 text-slate-900 shadow-xl shadow-rose-200/50'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 bg-rose-500/20 px-1.5 py-0.5 rounded">
                  CRITICAL ALERT
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Just now</span>
              </div>
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">
                {activeToast.title}
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                {activeToast.message}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                {activeToast.actionLink && onNavigateModule && (
                  <button
                    onClick={() => {
                      onNavigateModule(activeToast.actionLink!.module);
                      handleMarkAsRead(activeToast.id);
                      setActiveToast(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shadow-md shadow-rose-600/20"
                  >
                    <span>{activeToast.actionLink.label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => {
                    handleMarkAsRead(activeToast.id);
                    setActiveToast(null);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
