import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useToast } from './ToastContext';

export interface OfflineWalItem {
  productId: string;
  sku?: string;
  nameTh?: string;
  nameEn?: string;
  qty: number;
  unitPriceSatang?: number;
  lineTotalSatang?: number;
  [key: string]: any;
}

export interface OfflineWalPayload {
  idempotencyKey: string;
  orderNumber?: string;
  items: OfflineWalItem[];
  subtotalSatang?: number;
  discountSatang?: number;
  vatSatang?: number;
  totalSatang?: number;
  paymentMethod: string;
  payments?: any;
  cashTenderedSatang?: number;
  cashChangeSatang?: number;
  customerName?: string;
  customerPhone?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  appliedPromotions?: any[];
  kdsStatus?: string;
  status?: string;
  createdAt?: string;
  offlineQueuedAt?: string;
  [key: string]: any;
}

interface NetworkResilienceContextType {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  effectiveIsOnline: boolean;
  disconnectedAt: Date | null;
  lastHeartbeat: Date | null;
  heartbeatLatencyMs: number | null;
  pendingTransactions: OfflineWalPayload[];
  pendingCount: number;
  totalPendingSatang: number;
  isSyncing: boolean;
  syncProgress: { synced: number; total: number } | null;
  isOverlayOpen: boolean;
  setIsOverlayOpen: (open: boolean) => void;
  isMinimized: boolean;
  setIsMinimized: (minimized: boolean) => void;
  toggleSimulatedOffline: () => void;
  setSimulatedOffline: (val: boolean) => void;
  setOfflineWalQueue: React.Dispatch<React.SetStateAction<OfflineWalPayload[]>>;
  enqueueOfflineTransaction: (payload: any) => void;
  syncPendingTransactions: () => Promise<{ success: number; failed: number }>;
  clearPendingQueue: () => void;
  checkConnectionNow: () => Promise<boolean>;
  createMockOfflineOrder: () => void;
  dismissOverlay: () => void;
  expandOverlay: () => void;
}

const NetworkResilienceContext = createContext<NetworkResilienceContextType | undefined>(undefined);

export const NetworkResilienceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showSuccess, showWarning, showInfo, showError } = useToast();

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [disconnectedAt, setDisconnectedAt] = useState<Date | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [heartbeatLatencyMs, setHeartbeatLatencyMs] = useState<number | null>(null);

  const [isOverlayOpen, setIsOverlayOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{ synced: number; total: number } | null>(null);

  // Read initial WAL queue from localStorage
  const [pendingTransactions, setPendingTransactions] = useState<OfflineWalPayload[]>(() => {
    try {
      const saved = localStorage.getItem('prodx-offline-wal');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const effectiveIsOnline = isOnline && !isSimulatedOffline;

  // Sync state to localStorage
  const updatePendingTransactions = useCallback((newQueue: OfflineWalPayload[]) => {
    setPendingTransactions(newQueue);
    try {
      localStorage.setItem('prodx-offline-wal', JSON.stringify(newQueue));
    } catch (err) {
      console.error('Failed to persist WAL queue to localStorage:', err);
    }
    // Dispatch custom event for cross-component sync
    window.dispatchEvent(new CustomEvent('prodx-wal-updated', { detail: newQueue }));
  }, []);

  const setOfflineWalQueue = useCallback((action: React.SetStateAction<OfflineWalPayload[]>) => {
    setPendingTransactions((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      try {
        localStorage.setItem('prodx-offline-wal', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to persist WAL queue to localStorage:', err);
      }
      window.dispatchEvent(new CustomEvent('prodx-wal-updated', { detail: next }));
      return next;
    });
  }, []);

  // Listen to external changes to WAL queue
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'prodx-offline-wal' && e.newValue) {
        try {
          setPendingTransactions(JSON.parse(e.newValue));
        } catch {
          // ignore
        }
      }
    };

    const handleCustomWalUpdate = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setPendingTransactions(e.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('prodx-wal-updated', handleCustomWalUpdate);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('prodx-wal-updated', handleCustomWalUpdate);
    };
  }, []);

  // Browser online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (!isSimulatedOffline) {
        showSuccess('Network Restored', 'Terminal reconnected to secure cloud network.');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setDisconnectedAt(new Date());
      setIsOverlayOpen(true);
      setIsMinimized(false);
      showWarning('Connection Lost', 'App switched to Offline Mode. Local WAL storage engaged.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isSimulatedOffline, showSuccess, showWarning]);

  // Track state transitions for simulated offline
  const prevEffectiveOnline = useRef(effectiveIsOnline);
  useEffect(() => {
    if (prevEffectiveOnline.current && !effectiveIsOnline) {
      // Just went offline
      setDisconnectedAt(new Date());
      setIsOverlayOpen(true);
      setIsMinimized(false);
    } else if (!prevEffectiveOnline.current && effectiveIsOnline) {
      // Just came back online
      setDisconnectedAt(null);
    }
    prevEffectiveOnline.current = effectiveIsOnline;
  }, [effectiveIsOnline]);

  // Periodic heartbeat checker
  const checkConnectionNow = useCallback(async (): Promise<boolean> => {
    if (isSimulatedOffline) {
      return false;
    }
    const start = performance.now();
    try {
      const res = await fetch('/health', { method: 'GET', cache: 'no-store' });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        setIsOnline(true);
        setLastHeartbeat(new Date());
        setHeartbeatLatencyMs(latency);
        return true;
      } else {
        setIsOnline(false);
        return false;
      }
    } catch {
      setIsOnline(false);
      return false;
    }
  }, [isSimulatedOffline]);

  useEffect(() => {
    const interval = setInterval(() => {
      checkConnectionNow();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkConnectionNow]);

  const toggleSimulatedOffline = useCallback(() => {
    setIsSimulatedOffline((prev) => {
      const next = !prev;
      if (next) {
        setDisconnectedAt(new Date());
        setIsOverlayOpen(true);
        setIsMinimized(false);
        showWarning(
          'Simulated Offline Mode',
          'Network connection severed. Local Write-Ahead-Log engaged.'
        );
      } else {
        showSuccess(
          'Network Restored',
          'Simulated connection re-established. Terminal is online.'
        );
      }
      return next;
    });
  }, [showWarning, showSuccess]);

  const setSimulatedOffline = useCallback((val: boolean) => {
    setIsSimulatedOffline(val);
    if (val) {
      setDisconnectedAt(new Date());
      setIsOverlayOpen(true);
      setIsMinimized(false);
    }
  }, []);

  // Enqueue new offline transaction
  const enqueueOfflineTransaction = useCallback(
    (payload: any) => {
      const record: OfflineWalPayload = {
        ...payload,
        offlineQueuedAt: new Date().toISOString(),
      };
      setPendingTransactions((prev) => {
        const next = [...prev, record];
        try {
          localStorage.setItem('prodx-offline-wal', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        window.dispatchEvent(new CustomEvent('prodx-wal-updated', { detail: next }));
        return next;
      });
    },
    []
  );

  // Sync pending transactions to database
  const syncPendingTransactions = useCallback(async (): Promise<{ success: number; failed: number }> => {
    if (pendingTransactions.length === 0) {
      return { success: 0, failed: 0 };
    }

    setIsSyncing(true);
    setSyncProgress({ synced: 0, total: pendingTransactions.length });

    const queueCopy = [...pendingTransactions];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < queueCopy.length; i++) {
      const item = queueCopy[i];
      try {
        const res = await fetch('/api/orders/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (res.ok) {
          successCount++;
          setSyncProgress({ synced: successCount, total: queueCopy.length });
          // Shift from queue
          const remaining = queueCopy.slice(i + 1);
          updatePendingTransactions(remaining);
        } else {
          failedCount++;
          break; // preserve sequential ordering
        }
      } catch (err) {
        failedCount++;
        break;
      }
    }

    setIsSyncing(false);
    setSyncProgress(null);

    if (successCount > 0) {
      window.dispatchEvent(new CustomEvent('prodx-refresh-data'));
      showSuccess(
        'Database Sync Completed',
        `Successfully committed ${successCount} pending offline transactions to the cloud ledger.`
      );
    }
    if (failedCount > 0) {
      showError(
        'Sync Incomplete',
        `${failedCount} transactions could not be uploaded. Will retry automatically.`
      );
    }

    return { success: successCount, failed: failedCount };
  }, [pendingTransactions, updatePendingTransactions, showSuccess, showError]);

  const clearPendingQueue = useCallback(() => {
    updatePendingTransactions([]);
    showInfo('WAL Outbox Cleared', 'All pending offline transactions removed from local storage.');
  }, [updatePendingTransactions, showInfo]);

  // Quick helper to generate a mock offline order for test/verification
  const createMockOfflineOrder = useCallback(() => {
    const mockIdem = `idem-offline-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const mockOrderNum = `PX-OFF-${Date.now().toString().slice(-6)}`;
    const mockPayload: OfflineWalPayload = {
      idempotencyKey: mockIdem,
      orderNumber: mockOrderNum,
      items: [
        {
          productId: 'prod-01',
          nameTh: 'อเมริกาโน่เย็น (พรีเมียม)',
          nameEn: 'Iced Americano Premium Blend',
          qty: 1,
          unitPriceSatang: 6500,
          lineTotalSatang: 6500,
        },
        {
          productId: 'prod-02',
          nameTh: 'ครัวซองต์เนยสดฝรั่งเศส',
          nameEn: 'French Butter Croissant',
          qty: 2,
          unitPriceSatang: 8500,
          lineTotalSatang: 17000,
        },
      ],
      subtotalSatang: 23500,
      vatSatang: 1537,
      totalSatang: 23500,
      paymentMethod: 'CASH',
      cashTenderedSatang: 25000,
      cashChangeSatang: 1500,
      customerName: 'Walk-in Customer (Offline)',
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
      offlineQueuedAt: new Date().toISOString(),
    };

    enqueueOfflineTransaction(mockPayload);
    showInfo(
      'Offline Sale Queued',
      `Simulated sale of ฿235.00 logged into local WAL queue (${pendingTransactions.length + 1} pending).`
    );
  }, [enqueueOfflineTransaction, pendingTransactions.length, showInfo]);

  const dismissOverlay = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const expandOverlay = useCallback(() => {
    setIsOverlayOpen(true);
    setIsMinimized(false);
  }, []);

  const totalPendingSatang = useMemo(() => {
    return pendingTransactions.reduce((acc, t) => acc + (t.totalSatang || 0), 0);
  }, [pendingTransactions]);

  const value = {
    isOnline,
    isSimulatedOffline,
    effectiveIsOnline,
    disconnectedAt,
    lastHeartbeat,
    heartbeatLatencyMs,
    pendingTransactions,
    pendingCount: pendingTransactions.length,
    totalPendingSatang,
    isSyncing,
    syncProgress,
    isOverlayOpen,
    setIsOverlayOpen,
    isMinimized,
    setIsMinimized,
    toggleSimulatedOffline,
    setSimulatedOffline,
    setOfflineWalQueue,
    enqueueOfflineTransaction,
    syncPendingTransactions,
    clearPendingQueue,
    checkConnectionNow,
    createMockOfflineOrder,
    dismissOverlay,
    expandOverlay,
  };

  return (
    <NetworkResilienceContext.Provider value={value}>
      {children}
    </NetworkResilienceContext.Provider>
  );
};

export const useNetworkResilience = () => {
  const context = useContext(NetworkResilienceContext);
  if (!context) {
    throw new Error('useNetworkResilience must be used within a NetworkResilienceProvider');
  }
  return context;
};
