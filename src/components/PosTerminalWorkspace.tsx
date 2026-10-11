import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  ScanBarcode,
  Printer,
  RotateCcw,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Mail,
  Send,
  Eye,
  LogOut,
  X,
  CreditCard,
  QrCode,
  Banknote,
  User as UserIcon,
  Settings,
  Pause,
  FolderOpen,
  Unlock,
  Lock,
  Zap,
  Split,
  Users,
  Award,
  ArrowRightLeft,
  TrendingUp,
  BarChart3,
  Phone,
  Truck,
  Building2,
  FileText,
  Tag,
  Percent,
  Sparkles,
  Fingerprint,
  ScanFace,
  Tv,
  SlidersHorizontal,
  Mic,
  Layers,
  KeyRound,
} from 'lucide-react';
import { 
  ProductItem, 
  PosOrderRecord, 
  formatSatangToThb, 
  CustomerMember, 
  PaymentSplitEntry, 
  InterStoreTransferRecord, 
  ShelfVelocityAnalytics,
  AppliedPromotion,
  FullTaxInvoiceRecord,
  BiometricAuthResult,
  BatchCheckoutRecord,
} from '../types/prodx';
import { BiometricAuthorizePrompt } from './BiometricAuthorizePrompt';
import { BiometricAuthModal } from './BiometricAuthModal';
import { BiometricAuthorization } from './BiometricAuthorization';
import { StockPredictionWidget } from './StockPredictionWidget';
import { CustomerDisplayModal } from './CustomerDisplayModal';
import { PosVoiceCommandBar } from './PosVoiceCommandBar';
import { PosBatchPaymentModal } from './PosBatchPaymentModal';
import { PosPaymentTab } from './PosPaymentTab';
import { PosBatchEmailServiceModal } from './PosBatchEmailServiceModal';
import { SupervisorPinKeypad } from './SupervisorPinKeypad';
import { presentationService } from '../services/presentationService';
import { DEFAULT_PROMOTIONS } from '../services/customerDisplayPromos';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGmail, loginAsCashier, CashierSessionUser } from '../lib/firebaseAuth';
import {
  sendDigitalReceiptEmail,
  generateReceiptHtml,
  SentReceiptRecord,
} from '../lib/gmailReceiptService';
import { AntigravityHealthCards } from './AntigravityHealthCards';
import { useToast } from '../context/ToastContext';
import { useNetworkResilience } from '../context/NetworkResilienceContext';
import {
  useInventoryQuickActions,
  InventoryQuickActionController,
} from './inventory/InventoryQuickActionController';
import { ReceiptPrintQueueModal } from './ReceiptPrintQueueModal';

interface PosTerminalWorkspaceProps {
  products: ProductItem[];
  orders: PosOrderRecord[];
  onOrderCreated: (order: PosOrderRecord, isReplay: boolean) => void;
  onOrderOverridden: () => void;
  onStockAdjusted: () => void;
}

interface CartEntry {
  product: ProductItem;
  qty: number;
}

// Map high-quality images to categories
const CATEGORY_IMAGES: Record<string, string> = {
  COFFEE: '/src/assets/images/minimart_iced_latte_1791396408236.jpg',
  BAKERY: '/src/assets/images/minimart_croissant_butter_1791396420438.jpg',
  BEVERAGE: '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg',
  MERCHANDISE: '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg',
};

export const PosTerminalWorkspace: React.FC<PosTerminalWorkspaceProps> = ({
  products,
  orders,
  onOrderCreated,
  onOrderOverridden,
  onStockAdjusted,
}) => {
  const { showSuccess, showError: showGlobalError, showWarning, showInfo } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [discountThbInput, setDiscountThbInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT'>('PROMPTPAY_QR');
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState<string>(
    () => `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'REPLAY' | 'ERROR';
    text: string;
  } | null>(null);

  // Customer CRM & Loyalty Membership State
  const [customerPhoneQuery, setCustomerPhoneQuery] = useState<string>('');
  const [activeCustomer, setActiveCustomer] = useState<CustomerMember | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState<boolean>(false);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [isRegisteringCustomer, setIsRegisteringCustomer] = useState<boolean>(false);

  // Customer-Facing Display (CFD) Presentation API & Dual Monitor State
  const [isCustomerDisplayModalOpen, setIsCustomerDisplayModalOpen] = useState<boolean>(false);
  const [isCustomerDisplayConnected, setIsCustomerDisplayConnected] = useState<boolean>(
    presentationService.isConnected()
  );
  const [lastCompletedOrder, setLastCompletedOrder] = useState<PosOrderRecord | null>(null);
  const [isVoiceCommandOpen, setIsVoiceCommandOpen] = useState<boolean>(false);
  const [isBatchPaymentModalOpen, setIsBatchPaymentModalOpen] = useState<boolean>(false);
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState<boolean>(false);
  const [isFloatingKeypadOpen, setIsFloatingKeypadOpen] = useState<boolean>(false);
  const [floatingKeypadFeedback, setFloatingKeypadFeedback] = useState<string | null>(null);
  const [activePosTab, setActivePosTab] = useState<'REGISTER' | 'PAYMENT'>('REGISTER');
  const quickActions = useInventoryQuickActions();

  const eligibleBatchOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'COMPLETED' && !o.isBatchConsolidated).length;
  }, [orders]);

  const pendingEmailReceiptsCount = useMemo(() => {
    return orders.filter(
      (o) => Boolean(o.customerEmail || (o as any).recipientEmail) && (!o.emailReceiptStatus || o.emailReceiptStatus === 'PENDING')
    ).length;
  }, [orders]);

  useEffect(() => {
    const unsub = presentationService.onConnectionChange((connected) => {
      setIsCustomerDisplayConnected(connected);
    });
    return () => unsub();
  }, []);

  // Receipt Print Queue State
  const [isPrintQueueOpen, setIsPrintQueueOpen] = useState<boolean>(false);

  // Split Payment (Multi-Tender) State
  const [splitTenders, setSplitTenders] = useState<PaymentSplitEntry[]>([
    { id: 'sp-1', method: 'CASH', amountSatang: 0, createdAt: new Date().toISOString() },
    { id: 'sp-2', method: 'PROMPTPAY_QR', amountSatang: 0, createdAt: new Date().toISOString() },
  ]);
  const [activeSplitTenderIndex, setActiveSplitTenderIndex] = useState<number>(0);

  // Inter-Store Inventory Transfer State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferProductId, setTransferProductId] = useState<string>('');
  const [transferSourceStore, setTransferSourceStore] = useState<string>('BKK-FLAGSHIP-01');
  const [transferDestStore, setTransferDestStore] = useState<string>('BKK-SILOM-02');
  const [transferQty, setTransferQty] = useState<string>('10');
  const [transferReason, setTransferReason] = useState<string>('Inter-store stock balancing');
  const [transferSupervisorPin, setTransferSupervisorPin] = useState<string>('2580');
  const [isExecutingTransfer, setIsExecutingTransfer] = useState<boolean>(false);
  const [transferHistory, setTransferHistory] = useState<InterStoreTransferRecord[]>([]);

  // Restock PO State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState<boolean>(false);
  const [restockProductId, setRestockProductId] = useState<string>('');
  const [restockQty, setRestockQty] = useState<string>('30');
  const [isExecutingRestock, setIsExecutingRestock] = useState<boolean>(false);

  // Shelf Velocity Predictive Analytics State
  const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState<boolean>(false);
  const [shelfAnalytics, setShelfAnalytics] = useState<ShelfVelocityAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);

  // Connection & WAL Sync State (Connected to NetworkResilience Context)
  const networkResilience = useNetworkResilience();
  const isOnline = networkResilience.effectiveIsOnline;
  const offlineWalQueue = networkResilience.pendingTransactions;
  const setOfflineWalQueue = networkResilience.setOfflineWalQueue;
  const [islandExpanded, setIsIslandExpanded] = useState(false);

  // Ledger Filters & Collapsible Row State (A3)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ledgerPaymentFilter, setLedgerPaymentFilter] = useState<string>('ALL');
  const [ledgerPeriodFilter, setLedgerPeriodFilter] = useState<'ALL' | 'TODAY' | 'YESTERDAY'>('ALL');

  // Flying Add-To-Cart Physics State (B1)
  const [flyingBubbles, setFlyingBubbles] = useState<{ id: string; startX: number; startY: number; label: string }[]>([]);

  // High-Throughput Touch Presets & Numpad (C3)
  const [cashTenderedInput, setCashTenderedInput] = useState<string>('0');
  const [activeInputTarget, setActiveInputTarget] = useState<'CASH_TENDER' | 'DISCOUNT' | 'SPLIT_TENDER'>('CASH_TENDER');

  // Dynamic Bundle Promotions & Happy Hour State
  const [isHappyHourActive, setIsHappyHourActive] = useState<boolean>(() => {
    const hr = new Date().getHours();
    return hr >= 14 && hr <= 17;
  });

  // Full Tax Invoice (E-Tax) State
  const [taxInvoiceModalOrder, setTaxInvoiceModalOrder] = useState<PosOrderRecord | null>(null);
  const [taxCustomerName, setTaxCustomerName] = useState<string>('');
  const [taxIdInput, setTaxIdInput] = useState<string>('');
  const [taxBranchType, setTaxBranchType] = useState<'HEAD_OFFICE' | 'BRANCH'>('HEAD_OFFICE');
  const [taxBranchNumber, setTaxBranchNumber] = useState<string>('00000');
  const [taxAddress, setTaxAddress] = useState<string>('');
  const [isIssuingTaxInvoice, setIsIssuingTaxInvoice] = useState<boolean>(false);
  const [taxInvoicePreview, setTaxInvoicePreview] = useState<FullTaxInvoiceRecord | null>(null);

  // Gmail State
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [sendDigitalReceipt, setSendDigitalReceipt] = useState<boolean>(false);
  const [gmailUser, setGmailUser] = useState<User | CashierSessionUser | null>(null);
  const [gmailToken, setGmailToken] = useState<string | null>(null);
  const [isLoggingInGmail, setIsLoggingInGmail] = useState<boolean>(false);
  const [sentReceiptsHistory, setSentReceiptsHistory] = useState<SentReceiptRecord[]>([]);

  // Modals
  const [emailConfirmModal, setEmailConfirmModal] = useState<{
    order: PosOrderRecord;
    recipientEmail: string;
  } | null>(null);
  const [receiptPreviewModal, setReceiptPreviewModal] = useState<PosOrderRecord | null>(null);
  const [overrideTargetOrder, setOverrideTargetOrder] = useState<PosOrderRecord | null>(null);
  const [overrideAction, setOverrideAction] = useState<'REFUND' | 'VOID'>('REFUND');
  const [supervisorPin, setSupervisorPin] = useState<string>('2580');
  const [overrideReason, setOverrideReason] = useState<string>('Customer cancellation request');
  const [isOverriding, setIsOverriding] = useState<boolean>(false);
  const [isBiometricConsoleOpen, setIsBiometricConsoleOpen] = useState<boolean>(false);

  const handleExecuteOverride = async (authParams?: {
    method?: 'WEBAUTHN_BIOMETRIC' | 'PIN';
    biometricAuth?: BiometricAuthResult;
    supervisorPin?: string;
    supervisorName?: string;
  }) => {
    if (!overrideTargetOrder) return;
    setIsOverriding(true);
    try {
      const payload: any = {
        action: overrideAction,
        reason: overrideReason || `${overrideAction} authorized by Shift Supervisor`,
      };

      if (authParams?.biometricAuth) {
        payload.biometricAuth = authParams.biometricAuth;
      } else if (authParams?.supervisorPin) {
        payload.supervisorPin = authParams.supervisorPin;
      } else {
        payload.supervisorPin = supervisorPin;
      }

      const res = await fetch(`/api/orders/${overrideTargetOrder.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const authMethodText = authParams?.biometricAuth ? 'WebAuthn Biometric' : 'Supervisor PIN';
        showSuccess(
          `Order ${overrideAction === 'VOID' ? 'VOIDED' : 'REFUNDED'}`,
          `Transaction ${overrideTargetOrder.orderNumber} successfully overridden via ${authMethodText}. Inventory stock replenished.`
        );
        setStatusBanner({
          type: 'SUCCESS',
          text: `Supervisor Override Complete: ${overrideTargetOrder.orderNumber} -> ${overrideAction === 'VOID' ? 'VOIDED' : 'REFUNDED'} (${authMethodText})`,
        });
        setOverrideTargetOrder(null);
        setSupervisorPin('2580');
        onOrderOverridden();
        onStockAdjusted();
      } else {
        showGlobalError(
          'Override Rejected',
          data.error === 'INVALID_PIN'
            ? 'Supervisor PIN invalid. Valid test PINs: 2580 (Shift Sup) or 9999 (Store Mgr).'
            : data.error === 'BIOMETRIC_UNAUTHORIZED'
            ? 'Biometric authorization failed security policy validation.'
            : (data.error || 'Server rejected override.')
        );
      }
    } catch (err: any) {
      showGlobalError('Override Error', err?.message || 'Network error processing override');
    } finally {
      setIsOverriding(false);
    }
  };

  // Terminal Quick Actions States
  const [heldOrders, setHeldOrders] = useState<{ id: string; cart: CartEntry[]; discountThbInput: string; heldAt: string }[]>(() => {
    try {
      const saved = localStorage.getItem('prodx-held-orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [isStockPredictionModalOpen, setIsStockPredictionModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('prodx-held-orders', JSON.stringify(heldOrders));
  }, [heldOrders]);

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      setStatusBanner({
        type: 'ERROR',
        text: 'Hold Order aborted: Active cart is empty.',
      });
      return;
    }
    const newHeld = {
      id: `HELD-${Date.now().toString(36).toUpperCase()}`,
      cart,
      discountThbInput,
      heldAt: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
    setHeldOrders((prev) => [...prev, newHeld]);
    setCart([]);
    setDiscountThbInput('0');
    setStatusBanner({
      type: 'SUCCESS',
      text: `Current order successfully held under reference: ${newHeld.id}`,
    });
  };

  const handleRecallOrder = (heldId: string) => {
    const target = heldOrders.find((o) => o.id === heldId);
    if (!target) return;
    setCart(target.cart);
    setDiscountThbInput(target.discountThbInput);
    setHeldOrders((prev) => prev.filter((o) => o.id !== heldId));
    setStatusBanner({
      type: 'SUCCESS',
      text: `Successfully recalled order ${heldId} back to active cart.`,
    });
  };

  const handlePrintLastReceipt = () => {
    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    if (completedOrders.length === 0) {
      setStatusBanner({
        type: 'ERROR',
        text: 'No completed transactions found in ledger to print.',
      });
      return;
    }
    const lastOrder = completedOrders[completedOrders.length - 1];
    setReceiptPreviewModal(lastOrder);
    setStatusBanner({
      type: 'SUCCESS',
      text: `Printing last order receipt: ${lastOrder.orderNumber}`,
    });
  };

  const handleToggleDrawer = () => {
    setIsDrawerOpen((prev) => {
      const nextState = !prev;
      setStatusBanner({
        type: 'SUCCESS',
        text: nextState 
          ? 'Physical cash drawer unlocked & opened! Close after cash operation is done.' 
          : 'Cash drawer successfully closed and locked.',
      });
      return nextState;
    });
  };

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGmailUser(user);
        setGmailToken(token);
      },
      () => {
        setGmailUser(null);
        setGmailToken(null);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const fetchReceiptHistory = async () => {
    try {
      const res = await fetch('/api/receipts/history');
      if (res.ok) {
        const data = await res.json();
        setSentReceiptsHistory(data.history || []);
      }
    } catch {}
  };

  useEffect(() => {
    fetchReceiptHistory();
  }, []);

  // Global Keyboard / Barcode Scanner Interceptor (A1)
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Enter key marks scanner submission
      if (e.key === 'Enter') {
        if (buffer.trim().length > 0) {
          const matched = products.find(
            (p) =>
              p.sku.toLowerCase() === buffer.trim().toLowerCase() ||
              p.barcode?.toLowerCase() === buffer.trim().toLowerCase()
          );

          if (matched) {
            addToCart(matched);
            showSuccess(
              'Barcode Intercepted',
              `Scanned: ${matched.nameEn} (SKU: ${matched.sku})`
            );
            setStatusBanner({
              type: 'SUCCESS',
              text: `Rapid Scan: ${matched.nameEn} (฿${(matched.priceSatang / 100).toFixed(2)})`,
            });
            // Spawn a visual bubble at the center of screen pointing to cart
            setFlyingBubbles((prev) => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random()}`,
                startX: window.innerWidth / 2,
                startY: window.innerHeight / 2,
                label: `Scanned: ${matched.nameEn}`,
              },
            ]);
          } else {
            showWarning('Barcode Unmatched', `Scanned SKU/barcode "${buffer}" not found in catalog.`);
          }
          buffer = '';
        }
        return;
      }

      // Filter characters
      if (e.key.length !== 1) return;

      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      const currentTime = Date.now();
      const timeDelta = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Barcode scanners type very rapidly (< 45ms per stroke).
      // Also, if no input field is currently focused, accumulate anyway as general dashboard background scanning.
      if (timeDelta < 45 || !isInputFocused) {
        buffer += e.key;
        if (buffer.length > 30) {
          buffer = buffer.slice(-30);
        }
      } else {
        // slow typed char inside focused input, reset buffer
        buffer = e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, cart]);

  // Offline Write-Ahead-Log (WAL) Queue Replay Sync Worker (D1 & D3)
  useEffect(() => {
    if (isOnline && offlineWalQueue.length > 0) {
      const syncOfflineQueue = async () => {
        showInfo('Syncing WAL Outbox', `Synchronizing ${offlineWalQueue.length} offline transactions with cloud ledger...`);
        const remainingQueue = [...offlineWalQueue];
        let syncedCount = 0;
        
        for (const offlinePayload of offlineWalQueue) {
          try {
            const response = await fetch('/api/orders/checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(offlinePayload),
            });
            if (response.ok) {
              // Sequentially shift synced transaction out of local WAL outbox
              remainingQueue.shift();
              setOfflineWalQueue([...remainingQueue]);
              syncedCount++;
            } else {
              // Break processing stream to protect ordering integrity, retry on next connection interval
              break;
            }
          } catch {
            break;
          }
        }
        
        if (syncedCount > 0) {
          showSuccess(
            'WAL Sync Successful', 
            `Successfully synchronized ${syncedCount} local ledger records with the cloud.`
          );
          onStockAdjusted(); // Triggers catalog and order states refreshes on parent App
        }
      };
      
      syncOfflineQueue();
    }
  }, [isOnline, offlineWalQueue]);

  const handleGmailSignIn = async () => {
    setIsLoggingInGmail(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailToken(result.accessToken);
        setStatusBanner({
          type: 'SUCCESS',
          text: `Google Authorized: ${result.user.email || 'Store Operator'}`,
        });
      }
    } catch (err: any) {
      console.warn('Google Sign-In notice:', err);
      // Fallback to Store Cashier Admin session automatically if restricted by Google Cloud org policy
      const cashier = loginAsCashier('kamkokaewthodsawat@gmail.com', 'Thodsawat Kamkokaew (Store Admin)');
      setGmailUser(cashier.user);
      setGmailToken(cashier.accessToken);
      setStatusBanner({
        type: 'SUCCESS',
        text: 'Google Sign-In org-restricted: Auto-connected Store Cashier Mode (kamkokaewthodsawat@gmail.com)',
      });
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const handleConnectCashierDirectly = () => {
    const cashier = loginAsCashier('kamkokaewthodsawat@gmail.com', 'Thodsawat Kamkokaew (Store Admin)');
    setGmailUser(cashier.user);
    setGmailToken(cashier.accessToken);
    setStatusBanner({
      type: 'SUCCESS',
      text: 'Connected: Store Operator (kamkokaewthodsawat@gmail.com)',
    });
  };

  const detectedPromotions = useMemo<AppliedPromotion[]>(() => {
    const promos: AppliedPromotion[] = [];
    if (cart.length === 0) return promos;

    // Rule 1: Coffee + Bakery Combo Deal
    const coffeeItems = cart.filter(i => i.product.category === 'COFFEE');
    const bakeryItems = cart.filter(i => i.product.category === 'BAKERY');
    const totalCoffeeQty = coffeeItems.reduce((s, i) => s + i.qty, 0);
    const totalBakeryQty = bakeryItems.reduce((s, i) => s + i.qty, 0);
    const comboPairs = Math.min(totalCoffeeQty, totalBakeryQty);

    if (comboPairs > 0) {
      const discountSatang = comboPairs * 2000; // ฿20 per pair
      promos.push({
        id: 'promo-combo-cf-bk',
        name: `Coffee + Bakery Duo (x${comboPairs})`,
        code: 'COMBO-CF-BK',
        discountSatang,
        description: `฿${(discountSatang / 100).toFixed(2)} bundle savings on ${comboPairs} Coffee & Bakery pair(s)`,
      });
    }

    // Rule 2: Happy Hour Beverage Bliss (15% off)
    if (isHappyHourActive) {
      const beverageItems = cart.filter(i => i.product.category === 'BEVERAGE' || i.product.category === 'COFFEE');
      const beverageSubtotal = beverageItems.reduce((s, i) => s + (i.product.priceSatang * i.qty), 0);
      if (beverageSubtotal > 0) {
        const discountSatang = Math.round(beverageSubtotal * 0.15);
        promos.push({
          id: 'promo-happy-hour',
          name: 'Happy Hour Beverage Bliss (-15%)',
          code: 'HAPPY-15',
          discountSatang,
          description: '15% discount on all handcrafted drinks & coffee',
        });
      }
    }

    // Rule 3: Bulk Water 3-pack (Save ฿15 on every 3 bottles)
    const waterItems = cart.filter(i => i.product.sku === 'PX-BV-005' || i.product.nameEn.toLowerCase().includes('water'));
    const totalWaterQty = waterItems.reduce((s, i) => s + i.qty, 0);
    const waterTriplets = Math.floor(totalWaterQty / 3);
    if (waterTriplets > 0) {
      const discountSatang = waterTriplets * 1500; // ฿15 per 3 bottles
      promos.push({
        id: 'promo-bulk-water',
        name: `Bulk Water 3-Pack (x${waterTriplets})`,
        code: 'BULK-WATER',
        discountSatang,
        description: `Save ฿${(waterTriplets * 15).toFixed(2)} on every 3 bottles of premium water`,
      });
    }

    return promos;
  }, [cart, isHappyHourActive]);

  const financials = useMemo(() => {
    const subtotalSatang = cart.reduce((acc, c) => acc + (c.product.priceSatang || 0) * c.qty, 0);
    const parsedDiscountSatang = Math.max(0, Math.round((parseFloat(discountThbInput) || 0) * 100));
    const pointsDiscountSatang = Math.max(0, Math.round(Number(redeemedPoints) * 100));
    const promoDiscountSatang = detectedPromotions.reduce((s, p) => s + p.discountSatang, 0);
    const totalDiscountSatang = Math.min(subtotalSatang, parsedDiscountSatang + pointsDiscountSatang + promoDiscountSatang);
    const netSatang = subtotalSatang - totalDiscountSatang;
    const vatSatang = Math.round(netSatang * 0.07);
    const totalSatang = netSatang + vatSatang;
    const pointsToEarn = Math.floor(totalSatang / 2500); // 1 pt per 25 THB spent

    return { 
      subtotalSatang, 
      discountSatang: totalDiscountSatang, 
      directDiscountSatang: parsedDiscountSatang,
      pointsDiscountSatang,
      promoDiscountSatang,
      vatSatang, 
      totalSatang, 
      pointsToEarn 
    };
  }, [cart, discountThbInput, redeemedPoints, detectedPromotions]);

  // Real-time synchronization to Customer-Facing Display via Presentation API & BroadcastChannel
  useEffect(() => {
    const displayCart = cart.map((c) => ({
      productId: c.product.id,
      sku: c.product.sku,
      barcode: c.product.barcode,
      nameEn: c.product.nameEn,
      nameTh: c.product.nameTh,
      category: c.product.category,
      unitPriceSatang: c.product.priceSatang,
      qty: c.qty,
      lineTotalSatang: c.product.priceSatang * c.qty,
      imageUrl: CATEGORY_IMAGES[c.product.category],
    }));

    const displayCustomer = activeCustomer
      ? {
          id: activeCustomer.id,
          name: activeCustomer.name,
          phone: activeCustomer.phone,
          tier: activeCustomer.tier,
          pointsBalance: activeCustomer.pointsBalance,
        }
      : null;

    const completedDisplayOrder = lastCompletedOrder
      ? {
          orderNumber: lastCompletedOrder.orderNumber,
          queueNumber: lastCompletedOrder.queueNumber || 'A-01',
          totalSatang: lastCompletedOrder.totalSatang,
          paymentMethod: lastCompletedOrder.paymentMethod,
          cashTenderedSatang: lastCompletedOrder.cashTenderedSatang,
          cashChangeSatang: lastCompletedOrder.cashChangeSatang,
          pointsEarned: lastCompletedOrder.pointsEarned,
          completedAt: lastCompletedOrder.createdAt,
        }
      : null;

    presentationService.publishState({
      version: 1,
      timestamp: Date.now(),
      storeName: 'PRODX SPECIALTY COFFEE & ARTISAN BAKERY',
      branchName: 'Bangkok Flagship (BKK-FLAGSHIP-01)',
      terminalId: 'POS-BKK-01',
      cashierName: gmailUser?.displayName || 'Lead Cashier',
      status: completedDisplayOrder ? 'ORDER_COMPLETED' : cart.length > 0 ? 'RINGING' : 'IDLE',
      cart: displayCart,
      financials: {
        subtotalSatang: financials.subtotalSatang,
        discountSatang: financials.discountSatang,
        directDiscountSatang: financials.directDiscountSatang,
        pointsDiscountSatang: financials.pointsDiscountSatang,
        promoDiscountSatang: financials.promoDiscountSatang,
        vatSatang: financials.vatSatang,
        totalSatang: financials.totalSatang,
        pointsToEarn: financials.pointsToEarn,
      },
      activeCustomer: displayCustomer,
      paymentMethod,
      completedOrder: completedDisplayOrder,
      promotions: DEFAULT_PROMOTIONS,
    });
  }, [cart, financials, paymentMethod, activeCustomer, lastCompletedOrder, gmailUser]);

  const handleIssueTaxInvoice = async () => {
    if (!taxInvoiceModalOrder || !taxCustomerName.trim() || !taxIdInput.trim() || !taxAddress.trim()) {
      showWarning('Required Fields', 'Please fill in Company/Customer name, 13-digit Tax ID, and registered address.');
      return;
    }
    setIsIssuingTaxInvoice(true);
    try {
      const res = await fetch(`/api/orders/${taxInvoiceModalOrder.id}/tax-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: taxCustomerName,
          taxId: taxIdInput,
          branchType: taxBranchType,
          branchNumber: taxBranchNumber,
          address: taxAddress,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTaxInvoicePreview(data.taxInvoice);
        showSuccess('E-Tax Issued', `Tax Invoice ${data.taxInvoice.invoiceNumber} generated successfully!`);
        if (onOrderOverridden) {
          onOrderOverridden();
        }
      } else {
        showGlobalError('Tax Invoice Error', data.error);
      }
    } catch (err: any) {
      showGlobalError('Tax Invoice Error', err.message);
    } finally {
      setIsIssuingTaxInvoice(false);
    }
  };

  const changeDueSatang = useMemo(() => {
    const tenderedSatang = Math.max(0, Math.round((parseFloat(cashTenderedInput) || 0) * 100));
    return tenderedSatang - financials.totalSatang;
  }, [cashTenderedInput, financials.totalSatang]);

  const splitSummary = useMemo(() => {
    const totalAllocatedSatang = splitTenders.reduce((acc, t) => acc + (t.amountSatang || 0), 0);
    const remainingSatang = financials.totalSatang - totalAllocatedSatang;
    const isBalanced = financials.totalSatang > 0 && remainingSatang === 0;
    return { totalAllocatedSatang, remainingSatang, isBalanced };
  }, [splitTenders, financials.totalSatang]);

  const handleLookupCustomer = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : customerPhoneQuery).trim();
    if (!q) {
      setActiveCustomer(null);
      setRedeemedPoints(0);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const res = await fetch(`/api/customers/lookup?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.customer) {
        setActiveCustomer(data.customer);
        showSuccess('Loyalty Member Found', `${data.customer.name} (${data.customer.tier}) - Points: ${data.customer.pointsBalance}`);
      } else {
        setActiveCustomer(null);
        showInfo('Member Not Found', `No member found with query "${q}". You can register new member.`);
      }
    } catch {
      // transient
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  const handleRegisterCustomer = async () => {
    if (!newCustomerName || !newCustomerPhone) return;
    setIsRegisteringCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName, phone: newCustomerPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveCustomer(data.customer);
        setCustomerPhoneQuery(data.customer.phone);
        setIsNewCustomerModalOpen(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        showSuccess('Member Registered', `Welcome ${data.customer.name}! 50 welcome points credited.`);
      } else {
        showGlobalError('Registration Error', data.error || 'Failed to register member');
      }
    } catch (err: any) {
      showGlobalError('Registration Error', err.message);
    } finally {
      setIsRegisteringCustomer(false);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!transferProductId) {
      showWarning('Select Product', 'Please choose a product to transfer.');
      return;
    }
    setIsExecutingTransfer(true);
    try {
      const res = await fetch('/api/inventory/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: transferProductId,
          sourceStoreId: transferSourceStore,
          destinationStoreId: transferDestStore,
          qty: transferQty,
          reason: transferReason,
          supervisorPin: transferSupervisorPin,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('Stock Dispatched', `Transferred ${data.transfer.qty} units of ${data.transfer.sku} to ${data.transfer.destinationStoreId}`);
        setIsTransferModalOpen(false);
        onStockAdjusted();
        fetchTransfers();
      } else {
        showGlobalError('Transfer Failed', data.error === 'INVALID_PIN' ? 'Invalid Supervisor PIN' : data.error);
      }
    } catch (err: any) {
      showGlobalError('Transfer Error', err.message);
    } finally {
      setIsExecutingTransfer(false);
    }
  };

  const fetchTransfers = async () => {
    try {
      const res = await fetch('/api/inventory/transfers');
      if (res.ok) {
        const data = await res.json();
        setTransferHistory(data.transfers || []);
      }
    } catch {}
  };

  const handleExecuteRestock = async () => {
    if (!restockProductId) return;
    setIsExecutingRestock(true);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: restockProductId, restockQty }),
      });
      const data = await res.json();
      if (res.ok) {
        showSuccess('Restock Completed', `Restocked +${data.restockedQty} units. New balance: ${data.product.stock}`);
        setIsRestockModalOpen(false);
        onStockAdjusted();
      } else {
        showGlobalError('Restock Error', data.error);
      }
    } catch (err: any) {
      showGlobalError('Restock Error', err.message);
    } finally {
      setIsExecutingRestock(false);
    }
  };

  const fetchShelfAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch('/api/analytics/shelf-velocity');
      if (res.ok) {
        const data = await res.json();
        setShelfAnalytics(data);
      }
    } catch {} finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((ord) => {
        // Payment filter
        if (ledgerPaymentFilter !== 'ALL' && ord.paymentMethod !== ledgerPaymentFilter) return false;
        
        // Period filter
        if (ledgerPeriodFilter !== 'ALL') {
          const ordTime = new Date(ord.createdAt).getTime();
          const todayStart = new Date().setHours(0, 0, 0, 0);
          const yesterdayStart = todayStart - 24 * 3600000;
          if (ledgerPeriodFilter === 'TODAY' && ordTime < todayStart) return false;
          if (ledgerPeriodFilter === 'YESTERDAY' && (ordTime < yesterdayStart || ordTime >= todayStart)) return false;
        }
        
        return true;
      });
  }, [orders, ledgerPaymentFilter, ledgerPeriodFilter]);

  const addToCart = (product: ProductItem, quantity: number = 1) => {
    setCart((prev) => {
      const found = prev.find((item) => item.product.id === product.id);
      if (found) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: Math.min(product.stock, item.qty + quantity) } : item
        );
      }
      return [...prev, { product, qty: Math.min(product.stock, quantity) }];
    });
  };

  const handleProductClick = (e: React.MouseEvent<HTMLElement>, product: ProductItem) => {
    if (product.stock <= 0) return;
    addToCart(product);

    // Capture click coordinate for spring arc animation
    const startX = e.clientX || window.innerWidth / 2;
    const startY = e.clientY || window.innerHeight / 2;
    const label = `+1 ${product.nameEn}`;
    const id = `${Date.now()}-${Math.random()}`;

    setFlyingBubbles((prev) => [...prev, { id, startX, startY, label }]);

    // Auto-cleanup bubble after spring completes
    setTimeout(() => {
      setFlyingBubbles((prev) => prev.filter((b) => b.id !== id));
    }, 1000);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const nextQty = item.qty + delta;
          return nextQty > 0 ? { ...item, qty: Math.min(item.product.stock, nextQty) } : null;
        })
        .filter(Boolean) as CartEntry[]
    );
  };

  const handleCheckout = async (
    overrideMethod?: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT',
    overrideCashTenderedSatang?: number,
    transactionNotes?: string
  ) => {
    if (cart.length === 0) return;
    setSubmitting(true);

    const activeMethod = overrideMethod || paymentMethod;
    const activeTenderedSatang = overrideCashTenderedSatang !== undefined 
      ? overrideCashTenderedSatang 
      : (activeMethod === 'CASH' ? Math.round((parseFloat(cashTenderedInput) || 0) * 100) : undefined);
    const activeChangeSatang = activeMethod === 'CASH' && activeTenderedSatang !== undefined
      ? Math.max(0, activeTenderedSatang - financials.totalSatang)
      : undefined;

    const idempotencyKey = customIdempotencyKey;
    const checkoutItems = cart.map((c) => ({ productId: c.product.id, qty: c.qty }));
    const payload = {
      items: checkoutItems,
      discountSatang: financials.discountSatang,
      paymentMethod: activeMethod,
      payments: activeMethod === 'SPLIT' ? splitTenders : undefined,
      idempotencyKey,
      cashierName: 'System Admin',
      cashTenderedSatang: activeTenderedSatang,
      cashChangeSatang: activeChangeSatang,
      customerPhone: activeCustomer?.phone,
      redeemedPoints: redeemedPoints > 0 ? redeemedPoints : undefined,
      appliedPromotions: detectedPromotions.length > 0 ? detectedPromotions : undefined,
      notes: transactionNotes,
    };

    // If Offline: store in local Write-Ahead-Log (WAL) outbox (D1)
    if (!isOnline) {
      const mockOrderNum = `PX-WAL-${Date.now()}`;
      const mockOrder: PosOrderRecord = {
        id: `ord-wal-${Date.now()}`,
        orderNumber: mockOrderNum,
        queueNumber: `A-${String((orders.length % 99) + 1).padStart(2, '0')}`,
        storeId: 'BKK-FLAGSHIP-01',
        shiftId: 'SH-2026-AM',
        cashierName: 'Offline Operator',
        items: cart.map((c) => ({
          productId: c.product.id,
          sku: c.product.sku,
          nameTh: c.product.nameTh,
          qty: c.qty,
          unitPriceSatang: c.product.priceSatang,
          lineTotalSatang: c.product.priceSatang * c.qty,
        })),
        subtotalSatang: financials.subtotalSatang,
        discountSatang: financials.discountSatang,
        vatSatang: financials.vatSatang,
        totalSatang: financials.totalSatang,
        paymentMethod: activeMethod,
        payments: activeMethod === 'SPLIT' ? splitTenders : undefined,
        cashTenderedSatang: activeTenderedSatang,
        cashChangeSatang: activeChangeSatang,
        customerId: activeCustomer?.id,
        customerName: activeCustomer?.name,
        customerPhone: activeCustomer?.phone,
        customerEmail: customerEmail || undefined,
        emailReceiptStatus: customerEmail ? ('PENDING' as const) : undefined,
        pointsEarned: financials.pointsToEarn > 0 ? financials.pointsToEarn : undefined,
        pointsRedeemed: redeemedPoints > 0 ? redeemedPoints : undefined,
        appliedPromotions: detectedPromotions.length > 0 ? detectedPromotions : undefined,
        kdsStatus: 'PENDING',
        status: 'COMPLETED',
        idempotencyKey,
        createdAt: new Date().toISOString(),
      };

      // Append payload to offline WAL queue for sync replayer
      setOfflineWalQueue((prev) => [
        ...prev,
        {
          ...payload,
          orderNumber: mockOrderNum,
          totalSatang: financials.totalSatang,
          subtotalSatang: financials.subtotalSatang,
          createdAt: new Date().toISOString(),
          offlineQueuedAt: new Date().toISOString(),
        },
      ]);
      
      // Cut stock optimistically and push mock order to state (B3)
      onOrderCreated(mockOrder, false);
      setLastCompletedOrder(mockOrder);
      setTimeout(() => setLastCompletedOrder(null), 8000);

      setCart([]);
      setDiscountThbInput('0');
      setCashTenderedInput('0');
      setRedeemedPoints(0);
      setCustomIdempotencyKey(`idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
      setSubmitting(false);

      showWarning(
        'Offline Mode Active',
        `Transaction ${mockOrderNum} recorded inside local Write-Ahead-Log outbox. Auto-syncing when network returns.`
      );
      setStatusBanner({
        type: 'SUCCESS',
        text: `Offline Stored: ${mockOrderNum} (Pending Sync)`
      });
      return;
    }

    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        onOrderCreated(data.order, data.idempotentReplay);
        setLastCompletedOrder(data.order);
        setTimeout(() => setLastCompletedOrder(null), 8000);
        setCart([]);
        setDiscountThbInput('0');
        setCashTenderedInput('0');
        if (activeCustomer) {
          setActiveCustomer((prev) => prev ? {
            ...prev,
            pointsBalance: Math.max(0, prev.pointsBalance - redeemedPoints) + financials.pointsToEarn,
            totalSpentSatang: prev.totalSpentSatang + financials.totalSatang,
          } : null);
        }
        setRedeemedPoints(0);
        setCustomIdempotencyKey(`idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
        
        const orderMsg = data.idempotentReplay 
          ? `Idempotent replay successful: Transaction ${data.order.orderNumber} retrieved from memory cache.` 
          : `Order ${data.order.orderNumber} successfully recorded in the audit ledger database.`;
          
        showSuccess(
          data.idempotentReplay ? 'Order Cache Replayed' : 'Order Recorded Success', 
          orderMsg
        );

        if (sendDigitalReceipt && customerEmail) {
          setEmailConfirmModal({ order: data.order, recipientEmail: customerEmail });
        } else {
          setStatusBanner({ type: 'SUCCESS', text: `Transaction Complete: ${data.order.orderNumber}` });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const executeSendEmail = async () => {
    if (!emailConfirmModal) return;
    try {
      const activeToken = gmailToken || 'prodx-cashier-session-token';
      const result = await sendDigitalReceiptEmail({
        order: emailConfirmModal.order,
        recipientEmail: emailConfirmModal.recipientEmail,
        accessToken: activeToken,
      });
      if (result.ok) {
        setStatusBanner({ type: 'SUCCESS', text: `Digital receipt dispatched to ${emailConfirmModal.recipientEmail}` });
        setEmailConfirmModal(null);
        fetchReceiptHistory();
      } else {
        setStatusBanner({ type: 'ERROR', text: result.error || 'Failed to send receipt' });
      }
    } catch (err: any) {
      console.error(err);
      setStatusBanner({ type: 'ERROR', text: err?.message || 'Error dispatching receipt' });
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch = p.nameTh.toLowerCase().includes(q) || p.nameEn.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start relative min-h-[600px]">
      {/* Antigravity Service Interactive Health Metric Cards */}
      <div className="xl:col-span-12">
        <AntigravityHealthCards />
      </div>

      {/* C2. High-Fidelity Interactive Island Capsule */}
      <div className="xl:col-span-12 flex justify-center py-2">
        <motion.div
          layout
          onClick={() => setIsIslandExpanded(!islandExpanded)}
          className="bg-slate-900 text-white rounded-full px-5 py-2.5 shadow-xl border border-slate-800 flex flex-col items-center cursor-pointer select-none overflow-hidden max-w-xl w-full mx-auto"
          animate={{ height: islandExpanded ? 'auto' : '44px' }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        >
          {!islandExpanded ? (
            <div className="flex items-center justify-between w-full text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </span>
                <span className="font-bold uppercase tracking-tight">{isOnline ? 'ONLINE // SECURE' : 'OFFLINE // WAL MODE'}</span>
              </div>
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex items-center gap-1.5 font-sans font-bold">
                <Lock className={`w-3.5 h-3.5 ${isDrawerOpen ? 'text-rose-400 animate-bounce' : 'text-slate-400'}`} />
                <span className="uppercase text-[10px]">{isDrawerOpen ? 'Drawer Open (Warning)' : 'Drawer Secure'}</span>
              </div>
              <div className="h-4 w-px bg-slate-800" />
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  networkResilience.expandOverlay();
                }}
                title="Click to view Network Resilience & Pending WAL Outbox"
                className={`text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:underline transition-colors ${offlineWalQueue.length > 0 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}
              >
                Sync: {offlineWalQueue.length > 0 ? `${offlineWalQueue.length} Pending (Inspect)` : 'Active'}
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4 p-2 text-sm font-sans">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h5 className="font-bold text-slate-200">Terminal Operational Center</h5>
                <X className="w-4 h-4 text-slate-400 hover:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-500">NETWORK CAPABILITY</div>
                  <div className="font-bold flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isOnline ? 'Connected (Cloud)' : 'Disconnected (IDB WAL)'}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        networkResilience.expandOverlay();
                      }}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-sans cursor-pointer"
                    >
                      Resilience HUD
                    </button>
                  </div>
                </div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-500">PHYSICAL DRAWER</div>
                  <div className={`font-bold uppercase ${isDrawerOpen ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isDrawerOpen ? 'Unlocked / Open' : 'Locked / Secure'}
                  </div>
                </div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-500">SYNC LOG QUEUE (IndexedDB)</div>
                  <div className={`font-bold ${offlineWalQueue.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {offlineWalQueue.length > 0 ? `${offlineWalQueue.length} Pending Upload` : '0 Pending (WAL Synced)'}
                  </div>
                </div>
                <div className="space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-500">API LATENCY (P95)</div>
                  <div className="font-bold text-emerald-400">19ms (Optimized)</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 text-center font-mono pt-1">
                Click capsule again to collapse dashboard view
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {isDrawerOpen && (
        <div className="xl:col-span-12">
          <div className="bg-amber-500 text-slate-950 px-6 py-4 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg font-bold border border-amber-600 animate-pulse text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>SECURITY WARNING: The physical cash drawer is currently OPEN/UNLOCKED! Ensure it is closed and locked when unattended.</span>
            </div>
            <button 
              onClick={() => {
                setIsDrawerOpen(false);
                setStatusBanner({ type: 'SUCCESS', text: 'Cash drawer closed and locked.' });
              }}
              className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-white rounded-xl transition-colors text-xs uppercase font-extrabold shadow-md shrink-0 cursor-pointer"
            >
              Lock Drawer
            </button>
          </div>
        </div>
      )}

      {/* POS Terminal Workspace Primary Module Tabs Bar */}
      <div className="xl:col-span-12 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-3 shadow-sm">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActivePosTab('REGISTER')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activePosTab === 'REGISTER'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>1. Register & Catalog (ขายสินค้า)</span>
            {cart.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white text-emerald-800 text-[10px] font-mono font-black">
                {cart.reduce((acc, c) => acc + c.qty, 0)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePosTab('PAYMENT')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activePosTab === 'PAYMENT'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>2. Payment & QR Generator (แท็บชำระเงิน)</span>
            {cart.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[10px] font-mono font-black">
                ฿{(financials.totalSatang / 100).toFixed(2)}
              </span>
            )}
          </button>
        </div>

        <div className="hidden md:flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono px-3">
          <span className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            PromptPay Gateway Active
          </span>
          <span>|</span>
          <span className="text-slate-600 dark:text-slate-400 font-medium">Auto-Sync WAL Ready</span>
        </div>
      </div>

      {activePosTab === 'PAYMENT' ? (
        <div className="xl:col-span-12">
          <PosPaymentTab
            cart={cart}
            subtotalSatang={financials.subtotalSatang}
            discountSatang={financials.discountSatang}
            taxSatang={financials.vatSatang}
            totalSatang={financials.totalSatang}
            activeCustomer={activeCustomer}
            cashierName="System Admin"
            storeId="BKK-FLAGSHIP-01"
            recentOrders={orders}
            onCompleteOrder={async (details) => {
              const activeOverrideMethod = details.method === 'TRUEMONEY' ? 'PROMPTPAY_QR' : details.method;
              await handleCheckout(activeOverrideMethod, details.cashTenderedSatang, details.customerNotes);
              setActivePosTab('REGISTER');
            }}
            onSendToCustomerDisplay={(payload) => {
              presentationService.publishState({
                ...presentationService.getLatestState(),
                paymentMethod: 'PROMPTPAY_QR',
              });
            }}
          />
        </div>
      ) : (
        <>
          {/* Left side: Catalog & Search */}
      <div className="xl:col-span-8 space-y-8">
        {/* Navigation & Search Zone */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 overflow-x-auto no-scrollbar scroll-smooth">
            {['ALL', 'COFFEE', 'BEVERAGE', 'BAKERY', 'MERCHANDISE'].map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU or name..."
                className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent dark:border-slate-800 rounded-xl text-xs focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600/30 transition-all text-slate-900 dark:text-white placeholder:text-slate-400 font-medium"
              />
            </div>

            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Inter-Store Stock Transfer & Dispatch"
            >
              <Truck className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Transfer</span>
              {transferHistory.length > 0 && (
                <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-mono font-bold">
                  {transferHistory.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                fetchShelfAnalytics();
                setIsAnalyticsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Shelf Velocity & Peak Sales Analytics"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Analytics</span>
            </button>

            <button
              type="button"
              onClick={() => setIsBiometricConsoleOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="WebAuthn Supervisor Biometric Authenticator & Passkeys"
            >
              <Fingerprint className="w-3.5 h-3.5 text-purple-500" />
              <span className="hidden sm:inline">Biometrics</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPrintQueueOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="คิวพิมพ์ใบเสร็จและตรวจสอบสถานะเครื่องพิมพ์ (Receipt Print Queue & Spooler)"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Print Queue</span>
            </button>

            {/* Microphone-Based Voice Command Assistant Button */}
            <button
              type="button"
              onClick={() => setIsVoiceCommandOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                isVoiceCommandOpen
                  ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md shadow-rose-600/20'
                  : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
              title="สั่งการด้วยเสียง (Voice Command Support - Add Items & Finalize Orders)"
            >
              <Mic className={`w-3.5 h-3.5 ${isVoiceCommandOpen ? 'text-white animate-pulse' : 'text-rose-500'}`} />
              <span className="hidden sm:inline">Voice</span>
              {isVoiceCommandOpen && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              )}
            </button>

            {/* Batch Payment Mode Button */}
            <button
              type="button"
              onClick={() => setIsBatchPaymentModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="โหมดชำระเงินรวม (Batch Payment Mode - Group Multiple Orders into a Consolidated Checkout)"
            >
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden sm:inline">ชำระรวมบิล</span>
              {eligibleBatchOrdersCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-black bg-blue-600 text-white rounded-full">
                  {eligibleBatchOrdersCount}
                </span>
              )}
            </button>

            {/* Automated Batch Customer Email Receipts Service Button */}
            <button
              type="button"
              onClick={() => setIsBatchEmailModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all cursor-pointer shrink-0 shadow-sm"
              title="บริการส่งใบเสร็จอีเมลแบบ Batch อัตโนมัติ (Automated Customer Receipt Batch Email Service)"
            >
              <Mail className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="hidden sm:inline">ส่งใบเสร็จ Batch</span>
              {pendingEmailReceiptsCount > 0 ? (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-black bg-amber-500 text-slate-950 rounded-full animate-bounce">
                  {pendingEmailReceiptsCount}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-indigo-900/60 text-indigo-300 rounded-full">
                  Batch
                </span>
              )}
            </button>

            {/* Floating Supervisor PIN Keypad Button */}
            <button
              type="button"
              onClick={() => setIsFloatingKeypadOpen(!isFloatingKeypadOpen)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm ${
                isFloatingKeypadOpen
                  ? 'bg-amber-500 text-slate-950 font-black shadow-amber-500/20'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400'
              }`}
              title="แป้นพิมพ์ตัวเลขลอยสำหรับยืนยัน PIN คืนเงิน (Floating Numeric Keypad for Supervisor PIN Refunds)"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">PIN Keypad</span>
            </button>
          </div>
        </div>

        {/* Product Grid - Modern Minimart Style */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <motion.div
              key={p.id}
              role="button"
              tabIndex={p.stock > 0 ? 0 : -1}
              aria-disabled={p.stock <= 0}
              whileTap={p.stock > 0 ? { scale: 0.96 } : undefined}
              onClick={(e) => {
                if (p.stock > 0) handleProductClick(e, p);
              }}
              onKeyDown={(e) => {
                if (p.stock > 0 && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  handleProductClick(e as any, p);
                }
              }}
              onContextMenu={(e) => quickActions.handleContextMenu(e, p)}
              onTouchStart={(e) => quickActions.handleTouchStart(e, p)}
              onTouchMove={quickActions.handleTouchMove}
              onTouchEnd={quickActions.handleTouchEnd}
              onTouchCancel={quickActions.handleTouchEnd}
              className={`group flex flex-col text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-600/40 dark:hover:border-emerald-500/40 transition-all select-none relative ${
                p.stock <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
                <img
                  src={CATEGORY_IMAGES[p.category] || '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg'}
                  alt={p.nameEn}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2 py-0.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded text-[10px] font-bold text-slate-500 dark:text-slate-400 shadow-sm uppercase tracking-tight">
                  {p.category}
                </div>
                {/* Quick Action Context Menu Trigger */}
                <button
                  type="button"
                  title="Quick Actions (Update Stock / Reorder / Audit Trail)"
                  onClick={(e) => {
                    e.stopPropagation();
                    quickActions.handleQuickActionClick(e, p);
                  }}
                  className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/40 hover:bg-black/70 text-white/90 backdrop-blur-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-md"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors [text-wrap:balance]">
                    {p.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <span className="font-mono tracking-tight">{p.sku}</span>
                    <span aria-hidden="true" className="text-slate-200 dark:text-slate-700">·</span>
                    <span className={`${p.stock <= p.lowStockThreshold ? 'text-amber-600 dark:text-amber-400 font-bold' : ''} font-mono tabular-nums`}>
                      {p.stock} units
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-auto">
                  <span className="text-sm font-bold font-mono text-emerald-600/80 dark:text-emerald-400/80">฿</span>
                  <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tight">
                    {formatSatangToThb(p.priceSatang).replace('฿', '').trim()}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right side: Persistent Cart & Checkout */}
      <div className="xl:col-span-4 space-y-6 sticky top-28">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-slate-900 dark:text-white border border-slate-100 dark:border-slate-700">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Current Order</h2>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCustomerDisplayModalOpen(true)}
                title="Customer-Facing Display (Presentation API & Dual Monitor)"
                className={`px-2.5 py-1 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                  isCustomerDisplayConnected
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Display</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isCustomerDisplayConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              </button>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono tabular-nums">
                {cart.reduce((s, i) => s + i.qty, 0)} Items
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar max-h-[300px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">Cart is empty</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.product.id}-${idx}`} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                    <img src={CATEGORY_IMAGES[item.product.category]} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.product.nameEn}</div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                      {formatSatangToThb(item.product.priceSatang)} × {item.qty}
                    </div>
                  </div>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 border border-slate-200/50 dark:border-slate-700/50">
                    <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"><Minus className="w-3 h-3 text-slate-700 dark:text-slate-300" /></button>
                    <span className="w-8 text-center text-xs font-bold font-mono text-slate-900 dark:text-white">{item.qty}</span>
                    <button onClick={() => addToCart(item.product)} className="p-1 hover:bg-white dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"><Plus className="w-3 h-3 text-slate-700 dark:text-slate-300" /></button>
                  </div>
                  <button onClick={() => updateCartQty(item.product.id, -item.qty)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer" title="Remove Item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout UI */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-6">
            {/* Customer CRM Loyalty Strip */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Users className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Loyalty Member</span>
                </div>
                {activeCustomer ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCustomer(null);
                      setCustomerPhoneQuery('');
                      setRedeemedPoints(0);
                    }}
                    className="text-[10px] text-slate-400 hover:text-rose-500 font-bold cursor-pointer"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsNewCustomerModalOpen(true)}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New Member</span>
                  </button>
                )}
              </div>

              {!activeCustomer ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customerPhoneQuery}
                    onChange={(e) => setCustomerPhoneQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookupCustomer();
                    }}
                    placeholder="Phone: e.g. 0819987766..."
                    className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupCustomer()}
                    disabled={isSearchingCustomer || !customerPhoneQuery.trim()}
                    className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSearchingCustomer ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Find'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-emerald-500/20 shadow-sm">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{activeCustomer.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black font-mono uppercase ${
                          activeCustomer.tier === 'PLATINUM' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                          activeCustomer.tier === 'GOLD' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {activeCustomer.tier}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">{activeCustomer.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Balance</div>
                      <div className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {activeCustomer.pointsBalance} pts
                      </div>
                    </div>
                  </div>

                  {/* Point Redemption Selector */}
                  {activeCustomer.pointsBalance > 0 && financials.subtotalSatang > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>Redeem Points (1 pt = ฿1)</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                          -{formatSatangToThb(financials.pointsDiscountSatang)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 50, 100, Math.min(activeCustomer.pointsBalance, Math.floor(financials.subtotalSatang / 100))].filter((v, idx, arr) => arr.indexOf(v) === idx && v <= activeCustomer.pointsBalance).map((pts) => (
                          <button
                            key={pts}
                            type="button"
                            onClick={() => setRedeemedPoints(pts)}
                            className={`px-2 py-1 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer ${
                              redeemedPoints === pts
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                            }`}
                          >
                            {pts === 0 ? 'No Pts' : `Use ${pts} pts`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>Earning +{financials.pointsToEarn} pts with this purchase</span>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-1 bg-slate-100/80 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800">
                {[
                  { id: 'PROMPTPAY_QR', icon: QrCode, label: 'QR' },
                  { id: 'CREDIT_CARD', icon: CreditCard, label: 'Card' },
                  { id: 'CASH', icon: Banknote, label: 'Cash' },
                  { id: 'SPLIT', icon: Split, label: 'Split' },
                ].map((m) => {
                  const isActive = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPaymentMethod(m.id as any);
                        if (m.id === 'SPLIT') {
                          setActiveInputTarget('SPLIT_TENDER');
                          const half = Math.round(financials.totalSatang / 2);
                          setSplitTenders([
                            { id: 'sp-1', method: 'CASH', amountSatang: half, createdAt: new Date().toISOString() },
                            { id: 'sp-2', method: 'PROMPTPAY_QR', amountSatang: financials.totalSatang - half, createdAt: new Date().toISOString() },
                          ]);
                        } else if (m.id === 'CASH') {
                          setActiveInputTarget('CASH_TENDER');
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isActive
                          ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200/60 dark:border-slate-700 font-bold'
                          : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-850'
                      }`}
                    >
                      <m.icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* SPLIT PAYMENT - Dynamic Multi-Tender Allocation Panel */}
              {paymentMethod === 'SPLIT' && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Split className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Split Tenders ({splitTenders.length})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const half = Math.round(financials.totalSatang / 2);
                          setSplitTenders([
                            { id: 'sp-1', method: 'CASH', amountSatang: half, createdAt: new Date().toISOString() },
                            { id: 'sp-2', method: 'PROMPTPAY_QR', amountSatang: financials.totalSatang - half, createdAt: new Date().toISOString() },
                          ]);
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300 transition-colors cursor-pointer"
                      >
                        50/50 Split
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitTenders([
                            ...splitTenders,
                            { id: `sp-${Date.now()}`, method: 'CREDIT_CARD', amountSatang: Math.max(0, splitSummary.remainingSatang), createdAt: new Date().toISOString() }
                          ]);
                          setActiveSplitTenderIndex(splitTenders.length);
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded hover:bg-emerald-200 transition-colors cursor-pointer"
                      >
                        + Tender
                      </button>
                    </div>
                  </div>

                  {/* Split Tenders List */}
                  <div className="space-y-2">
                    {splitTenders.map((tender, index) => {
                      const isSelected = activeSplitTenderIndex === index;
                      return (
                        <div 
                          key={tender.id}
                          onClick={() => {
                            setActiveSplitTenderIndex(index);
                            setActiveInputTarget('SPLIT_TENDER');
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-sm ring-1 ring-emerald-500/20' 
                              : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                          }`}
                        >
                          <select
                            value={tender.method}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setSplitTenders(prev => prev.map((t, i) => i === index ? { ...t, method: val } : t));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1.5 border-none text-slate-900 dark:text-white"
                          >
                            <option value="CASH">Cash</option>
                            <option value="PROMPTPAY_QR">QR Code</option>
                            <option value="CREDIT_CARD">Credit Card</option>
                          </select>
                          <div className="flex-1 text-right">
                            <span className="text-[10px] text-slate-400 mr-1">฿</span>
                            <span className="font-mono font-bold text-sm tabular-nums text-slate-900 dark:text-white">
                              {(tender.amountSatang / 100).toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (splitTenders.length > 1) {
                                setSplitTenders(prev => prev.filter((_, i) => i !== index));
                                setActiveSplitTenderIndex(0);
                              }
                            }}
                            disabled={splitTenders.length <= 1}
                            className="p-1 text-slate-300 hover:text-rose-500 transition-colors disabled:opacity-30 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Allocation Status Indicator */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Remaining to Settle:</span>
                    <span className={`font-mono font-black tabular-nums ${
                      splitSummary.remainingSatang === 0 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : splitSummary.remainingSatang > 0 
                        ? 'text-amber-600 dark:text-amber-400' 
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {splitSummary.remainingSatang === 0 
                        ? '✓ Balanced (฿0.00)' 
                        : `฿${(splitSummary.remainingSatang / 100).toFixed(2)}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Dynamic Bundle Promotions & Happy Hour Engine Strip */}
              <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-400">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Auto Promotions Engine</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHappyHourActive(!isHappyHourActive)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      isHappyHourActive
                        ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>Happy Hour</span>
                    <span className="font-mono">{isHappyHourActive ? 'ON (-15%)' : 'OFF'}</span>
                  </button>
                </div>

                {detectedPromotions.length > 0 ? (
                  <div className="space-y-1.5 pt-1">
                    {detectedPromotions.map((promo) => (
                      <div key={promo.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-emerald-500/20 shadow-xs">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-emerald-500" />
                          <span className="font-bold text-slate-900 dark:text-white text-[11px]">{promo.name}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          -฿{(promo.discountSatang / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Add Coffee + Bakery or toggle Happy Hour to trigger automatic bundle savings.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Discount (THB)</label>
                  <input
                    type="number"
                    value={discountThbInput}
                    onChange={(e) => setDiscountThbInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Digital Receipt</span>
                    <input
                      type="checkbox"
                      checked={sendDigitalReceipt}
                      onChange={(e) => setSendDigitalReceipt(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>
                  {sendDigitalReceipt && (
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Customer Email"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              
              {/* CASH & SPLIT Payment - Tactile Numpad & Change Panel (C3) */}
              {(paymentMethod === 'CASH' || paymentMethod === 'SPLIT') && (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Target</span>
                    <div className="flex gap-1.5">
                      {paymentMethod === 'CASH' && (
                        <button
                          type="button"
                          onClick={() => setActiveInputTarget('CASH_TENDER')}
                          className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            activeInputTarget === 'CASH_TENDER'
                              ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          Cash Tender
                        </button>
                      )}
                      {paymentMethod === 'SPLIT' && (
                        <button
                          type="button"
                          onClick={() => setActiveInputTarget('SPLIT_TENDER')}
                          className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                            activeInputTarget === 'SPLIT_TENDER'
                              ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          Split #{activeSplitTenderIndex + 1}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveInputTarget('DISCOUNT')}
                        className={`px-2 py-1 text-[10px] font-bold rounded cursor-pointer ${
                          activeInputTarget === 'DISCOUNT'
                            ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        Discount
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-900 dark:bg-slate-900/90 text-white rounded-lg p-3 border border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {activeInputTarget === 'CASH_TENDER' ? 'Cash Tendered' : activeInputTarget === 'SPLIT_TENDER' ? `Split Tender #${activeSplitTenderIndex + 1}` : 'Custom Discount'}
                    </div>
                    <div className="text-lg font-black font-mono tabular-nums">
                      ฿{activeInputTarget === 'CASH_TENDER' 
                        ? parseFloat(cashTenderedInput).toFixed(2) 
                        : activeInputTarget === 'SPLIT_TENDER'
                        ? ((splitTenders[activeSplitTenderIndex]?.amountSatang || 0) / 100).toFixed(2)
                        : parseFloat(discountThbInput).toFixed(2)}
                    </div>
                  </div>

                  {paymentMethod === 'CASH' && (
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Change Due</span>
                      <span className={`text-sm font-black font-mono tabular-nums ${changeDueSatang >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 font-bold'}`}>
                        {changeDueSatang >= 0 ? `฿${(changeDueSatang / 100).toFixed(2)}` : 'Insufficient Cash'}
                      </span>
                    </div>
                  )}

                  {/* Presets Row */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {[50, 100, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (activeInputTarget === 'CASH_TENDER') {
                            setCashTenderedInput(preset.toString());
                          } else if (activeInputTarget === 'SPLIT_TENDER') {
                            setSplitTenders(prev => prev.map((t, idx) => idx === activeSplitTenderIndex ? { ...t, amountSatang: preset * 100 } : t));
                          } else {
                            setDiscountThbInput(preset.toString());
                          }
                        }}
                        className="py-1.5 text-xs font-black font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>

                  {/* Exact Change & Quick Tender Buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (activeInputTarget === 'SPLIT_TENDER') {
                          setSplitTenders(prev => prev.map((t, idx) => idx === activeSplitTenderIndex ? { ...t, amountSatang: Math.max(0, splitSummary.remainingSatang + t.amountSatang) } : t));
                        } else {
                          setCashTenderedInput((financials.totalSatang / 100).toString());
                        }
                      }}
                      className="py-2 text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/40 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all active:scale-95 cursor-pointer"
                    >
                      {activeInputTarget === 'SPLIT_TENDER' ? 'Allocate Remainder' : 'Exact Change'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeInputTarget === 'CASH_TENDER') {
                          setCashTenderedInput('0');
                        } else if (activeInputTarget === 'SPLIT_TENDER') {
                          setSplitTenders(prev => prev.map((t, idx) => idx === activeSplitTenderIndex ? { ...t, amountSatang: 0 } : t));
                        } else {
                          setDiscountThbInput('0');
                        }
                      }}
                      className="py-2 text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  {/* Numeric Keypad grid (3x4) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '⌫'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (activeInputTarget === 'SPLIT_TENDER') {
                            setSplitTenders(prev => prev.map((t, idx) => {
                              if (idx !== activeSplitTenderIndex) return t;
                              const currentThb = (t.amountSatang / 100).toString();
                              let nextStr = currentThb;
                              if (key === '⌫') {
                                nextStr = nextStr.length > 1 ? nextStr.slice(0, -1) : '0';
                              } else if (key === '.') {
                                nextStr = nextStr.includes('.') ? nextStr : nextStr + '.';
                              } else {
                                nextStr = nextStr === '0' ? key : nextStr + key;
                              }
                              return { ...t, amountSatang: Math.round((parseFloat(nextStr) || 0) * 100) };
                            }));
                          } else {
                            const targetValue = activeInputTarget === 'CASH_TENDER' ? cashTenderedInput : discountThbInput;
                            const setTargetValue = activeInputTarget === 'CASH_TENDER' ? setCashTenderedInput : setDiscountThbInput;

                            if (key === '⌫') {
                              setTargetValue((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
                            } else if (key === '.') {
                              setTargetValue((prev) => (prev.includes('.') ? prev : prev + '.'));
                            } else {
                              setTargetValue((prev) => (prev === '0' ? key : prev + key));
                            }
                          }
                        }}
                        className="py-2 text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors shadow-sm text-slate-800 dark:text-slate-100 flex items-center justify-center active:scale-95 cursor-pointer"
                      >
                        {key}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">Subtotal</span>
                <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums text-sm font-medium">
                  {formatSatangToThb(financials.subtotalSatang)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 tracking-wider uppercase">Discount</span>
                <span className="font-mono text-amber-600 dark:text-amber-400 tabular-nums text-sm font-medium">
                  -{formatSatangToThb(financials.discountSatang)}
                </span>
              </div>
              
              <div className="h-px bg-slate-200/80 dark:bg-slate-800 my-2" />
 
              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">TOTAL PAYABLE</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-slate-400 dark:text-slate-500 text-lg font-sans">฿</span>
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums tracking-tighter">
                      {(financials.totalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
 
                 <button
                   onClick={() => handleCheckout()}
                   disabled={
                     submitting || 
                     cart.length === 0 || 
                     (paymentMethod === 'CASH' && changeDueSatang < 0) ||
                     (paymentMethod === 'SPLIT' && splitSummary.remainingSatang !== 0)
                   }
                   className={`w-full py-4 px-4 flex items-center justify-center gap-2 uppercase text-xs font-bold tracking-widest rounded-xl transition-all active:scale-[0.98] cursor-pointer ${
                     submitting || 
                     cart.length === 0 || 
                     (paymentMethod === 'CASH' && changeDueSatang < 0) ||
                     (paymentMethod === 'SPLIT' && splitSummary.remainingSatang !== 0)
                       ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed font-semibold'
                       : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                   }`}
                 >
                   <Printer className="w-5 h-5" />
                   <span>{paymentMethod === 'SPLIT' && splitSummary.remainingSatang !== 0 ? 'Settle All Splits to Pay' : 'Execute Pay'}</span>
                 </button>
               </div>
             </div>
          </div>
        </div>

        {/* Account & Integrations Quick Control */}
        <div className="p-4 bg-zinc-50 dark:bg-slate-900 rounded-2xl border border-zinc-200/80 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${gmailToken ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-200 dark:bg-slate-800 text-zinc-500 dark:text-slate-400'}`}>
                <Mail className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-bold uppercase tracking-tight text-zinc-800 dark:text-slate-200">
                  {gmailUser ? (gmailUser.email || (gmailUser as any).displayName || 'Store Operator') : 'Receipt & Operator Account'}
                </div>
                <div className="text-[10px] text-zinc-500 dark:text-slate-400 font-medium">
                  {gmailToken ? 'Verified • Ready to dispatch e-receipts' : 'Connect operator to authorize receipts'}
                </div>
              </div>
            </div>
            {gmailUser ? (
              <button
                onClick={() => logoutGmail()}
                title="Disconnect Account"
                className="p-2 text-zinc-400 hover:text-rose-600 rounded-lg transition-colors hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleConnectCashierDirectly}
                  title="Connect as Store Cashier Admin"
                  className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition-colors tracking-wider cursor-pointer"
                >
                  Operator
                </button>
                <button
                  onClick={handleGmailSignIn}
                  disabled={isLoggingInGmail}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-colors tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  {isLoggingInGmail ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Google'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      )}

      {/* History & Logs Section (Unboxed Table) */}
      <div className="xl:col-span-12 pt-16 space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Transaction Ledger</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100/50 dark:border-emerald-900/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Audit Chain Secure</span>
              </div>
              <span aria-hidden="true" className="text-slate-200 dark:text-slate-800">/</span>
              <span>SHA-256 HASHED</span>
            </div>
          </div>
          <button 
            onClick={fetchReceiptHistory} 
            className="p-2.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-white dark:hover:bg-slate-900 hover:shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Real-time filters panel (A3) */}
        <div className="flex flex-col lg:flex-row items-center gap-6 justify-between bg-slate-100/50 dark:bg-slate-900/40 p-4 rounded-3xl border border-slate-200/40 dark:border-slate-800/60 font-sans">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Method</span>
            <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80 w-full sm:w-auto">
              {['ALL', 'CASH', 'PROMPTPAY_QR', 'CREDIT_CARD'].map((m) => (
                <button
                  key={m}
                  onClick={() => setLedgerPaymentFilter(m)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${
                    ledgerPaymentFilter === m
                      ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {m === 'ALL' ? 'All Methods' : m.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Period</span>
            <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80 w-full sm:w-auto">
              {[
                { id: 'ALL', label: 'All History' },
                { id: 'TODAY', label: 'Today Only' },
                { id: 'YESTERDAY', label: 'Yesterday' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setLedgerPeriodFilter(p.id as any)}
                  className={`flex-1 sm:flex-none px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${
                    ledgerPeriodFilter === p.id
                      ? 'bg-slate-900 text-white dark:bg-slate-800 dark:text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ledger table */}
        <div className="overflow-x-auto border-y border-slate-100 dark:border-slate-800">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] bg-slate-50/50 dark:bg-slate-900/20">
                <th className="py-5 px-6">Order ID</th>
                <th className="py-5 px-6">Time</th>
                <th className="py-5 px-6">Items</th>
                <th className="py-5 px-6">Method</th>
                <th className="py-5 px-6 text-right">Total</th>
                <th className="py-5 px-6 text-center">Status</th>
                <th className="py-5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredOrders.slice(0, 15).map((ord, idx) => (
                <tr key={`${ord.id || ord.orderNumber}-${idx}`} className="group hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                  <td 
                    onClick={() => setExpandedOrderId(expandedOrderId === ord.id ? null : ord.id)}
                    className="py-5 px-6 font-mono font-bold text-slate-900 dark:text-white tracking-tight cursor-pointer hover:underline"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{ord.orderNumber}</span>
                      {ord.queueNumber && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                          {ord.queueNumber}
                        </span>
                      )}
                      {ord.taxInvoice && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          E-TAX
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-[13px] text-slate-500 font-medium font-mono tabular-nums">
                    {new Date(ord.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                  </td>
                  <td className="py-5 px-6">
                    <div className="text-[13px] text-slate-600 dark:text-slate-400 font-medium truncate max-w-xs">
                      {ord.items.map((i) => `${i.nameTh} x${i.qty}`).join(' · ')}
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">
                      {ord.paymentMethod.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-5 px-6 text-right font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                    <span className="text-slate-300 dark:text-slate-600 text-xs font-sans mr-0.5">฿</span>
                    {formatSatangToThb(ord.totalSatang).replace('฿', '').trim()}
                  </td>
                  <td className="py-5 px-6 text-center">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${ord.status === 'COMPLETED' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      <button 
                        onClick={() => setExpandedOrderId(expandedOrderId === ord.id ? null : ord.id)}
                        className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer"
                        title="Audit Log details"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => setReceiptPreviewModal(ord)} className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent hover:border-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer" title="Preview Receipt"><Eye className="w-4 h-4" /></button>
                      <button 
                        onClick={() => setEmailConfirmModal({ order: ord, recipientEmail: customerEmail || 'customer@example.com' })} 
                        className="p-2 text-slate-400 hover:text-emerald-600 border border-transparent hover:border-emerald-100 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all cursor-pointer"
                        title="Dispatch Digital Receipt"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      {ord.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setTaxInvoiceModalOrder(ord);
                            setTaxCustomerName(ord.customerName || '');
                            setTaxIdInput('');
                            setTaxAddress('');
                            setTaxInvoicePreview(ord.taxInvoice || null);
                          }}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            ord.taxInvoice
                              ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                              : 'text-slate-400 hover:text-indigo-600 border-transparent hover:border-indigo-100 dark:hover:bg-indigo-950/20'
                          }`}
                          title={ord.taxInvoice ? 'View Full Tax Invoice (Issued)' : 'Issue Full Tax Invoice (ใบกำกับภาษีเต็มรูป)'}
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                      {ord.status === 'COMPLETED' && (
                        <button
                          onClick={() => {
                            setOverrideTargetOrder(ord);
                            setOverrideAction('REFUND');
                          }}
                          className="p-2 text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 border border-transparent hover:border-amber-200 dark:hover:border-amber-900/60 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-all cursor-pointer"
                          title="Supervisor Override (Refund / Void)"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inline Audit Drawers (Collapsible Details) (A3) */}
        {expandedOrderId && (() => {
          const ord = orders.find((o) => o.id === expandedOrderId);
          if (!ord) return null;
          return (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-slate-50/80 dark:bg-slate-900/30 p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/80 font-sans"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800/80 pb-4 mb-4">
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">Audit Record Detail: {ord.orderNumber}</h4>
                  <p className="text-slate-400 text-xs font-mono font-semibold uppercase tracking-wider">SEQUENCE-SECURED LEDGER RECORD</p>
                </div>
                <button 
                  onClick={() => setExpandedOrderId(null)} 
                  className="p-1.5 bg-slate-200/60 dark:bg-slate-800 text-slate-500 rounded-full hover:bg-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Column 1: Items Purchased */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Transaction Items</h5>
                  <div className="space-y-2 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 max-h-[220px] overflow-y-auto no-scrollbar shadow-sm">
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="text-slate-800 dark:text-slate-300">
                          <span className="font-black text-emerald-600 dark:text-emerald-400 mr-1.5">x{item.qty}</span>
                          <span className="font-medium">{item.nameTh}</span>
                        </div>
                        <div className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">
                          ฿{((item.lineTotalSatang) / 100).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 2: Financial Audit */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-[10px] text-slate-400 uppercase tracking-widest">Financial Audit Details</h5>
                  <div className="space-y-2.5 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 font-mono shadow-sm">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Total Subtotal</span>
                      <span className="text-slate-800 dark:text-slate-300 font-bold">฿{(ord.subtotalSatang / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-500">
                      <span>Total Discounts</span>
                      <span className="font-bold">-฿{(ord.discountSatang / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">VAT (7.00%)</span>
                      <span className="text-slate-800 dark:text-slate-300 font-bold">฿{(ord.vatSatang / 100).toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-1" />
                    <div className="flex justify-between text-xs font-black text-emerald-600 dark:text-emerald-400">
                      <span>Total Net Paid</span>
                      <span>฿{(ord.totalSatang / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Cryptographic Signatures */}
                <div className="space-y-3">
                  <h5 className="font-extrabold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Cryptographic Signature</h5>
                  <div className="space-y-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-emerald-500/20 dark:border-emerald-950/20 bg-emerald-50/5 dark:bg-emerald-950/5 text-xs font-mono text-slate-500 shadow-sm leading-relaxed">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-black text-slate-400">IDEMPOTENCY SIGNATURE (HMAC-SHA256)</span>
                      <div className="text-slate-800 dark:text-slate-200 break-all select-all font-bold text-[10px] bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800/80">{ord.idempotencyKey}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <span className="text-slate-400 font-bold block">OPERATOR ID</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold">{ord.cashierName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block">SHIFT ID</span>
                        <span className="text-slate-800 dark:text-slate-300 font-bold">{ord.shiftId}</span>
                      </div>
                    </div>
                    <div className="h-px bg-emerald-500/10" />
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>CRYPTOGRAPHIC INTEGRITY GUARANTEED</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </div>

      {/* Modals - Simplified & Refined */}
      {receiptPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-8 flex items-center justify-between border-b border-slate-100">
              <div className="space-y-1">
                <h4 className="text-xl font-black text-slate-900 tracking-tight">Receipt Preview</h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">{receiptPreviewModal.orderNumber}</p>
              </div>
              <button onClick={() => setReceiptPreviewModal(null)} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
              <iframe title="Receipt" srcDoc={generateReceiptHtml(receiptPreviewModal)} className="w-full h-[500px] border border-slate-200 rounded-2xl bg-white shadow-sm" />
            </div>
          </div>
        </div>
      )}

      {emailConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-md w-full p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/40">
                <Mail className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Send Digital Receipt</h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Recipient: <span className="font-bold text-slate-900 dark:text-white">{emailConfirmModal.recipientEmail}</span></p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                <span>Total Amount</span>
                <span className="text-slate-900 dark:text-white font-mono tabular-nums">{formatSatangToThb(emailConfirmModal.order.totalSatang)}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEmailConfirmModal(null)} className="flex-1 px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer">Cancel</button>
              <button onClick={executeSendEmail} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer">
                <Send className="w-4 h-4" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Override Modal (Refund / Void) */}
      {overrideTargetOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-lg w-full p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-500/20">
                  <RotateCcw className="w-6 h-6 animate-spin-reverse" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Supervisor Override</h4>
                  <p className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider">{overrideTargetOrder.orderNumber}</p>
                </div>
              </div>
              <button
                onClick={() => setOverrideTargetOrder(null)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reversal Type Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Override Action</label>
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setOverrideAction('REFUND')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    overrideAction === 'REFUND'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  REFUND (Return)
                </button>
                <button
                  type="button"
                  onClick={() => setOverrideAction('VOID')}
                  className={`py-3 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    overrideAction === 'VOID'
                      ? 'bg-rose-600 text-white shadow-md font-extrabold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  VOID (Cancel Sale)
                </button>
              </div>
            </div>

            {/* Financial & Items Reversal Summary */}
            <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 space-y-2.5 border border-slate-100 dark:border-slate-800 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Reversible Amount</span>
                <span className="text-slate-900 dark:text-white font-mono font-bold text-base tabular-nums">
                  ฿{(overrideTargetOrder.totalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Payment Tender</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono font-bold uppercase">{overrideTargetOrder.paymentMethod.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Stock Restoration</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  +{overrideTargetOrder.items.reduce((acc, it) => acc + it.qty, 0)} units replenished
                </span>
              </div>
            </div>

            {/* Audit Reason Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reason for Audit Log</label>
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Reason for supervisor override..."
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
              />
            </div>

            {/* Biometric WebAuthn & PIN Fallback Authorization Component */}
            <div className="pt-1">
              <BiometricAuthorization
                action={overrideAction}
                actionLabel={`SUPERVISOR ${overrideAction}`}
                targetDescription={`${overrideTargetOrder.orderNumber} • ฿${(overrideTargetOrder.totalSatang / 100).toFixed(2)}`}
                orderId={overrideTargetOrder.id}
                orderNumber={overrideTargetOrder.orderNumber}
                amountSatang={overrideTargetOrder.totalSatang}
                itemsCount={overrideTargetOrder.items.reduce((acc, it) => acc + it.qty, 0)}
                reason={overrideReason}
                onAuthorized={(authResult) => {
                  handleExecuteOverride(authResult);
                }}
                onCancel={() => setOverrideTargetOrder(null)}
                allowPinFallback={true}
              />
            </div>

            {/* Cancel Action */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setOverrideTargetOrder(null)}
                className="w-full px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all text-xs uppercase tracking-wider cursor-pointer"
              >
                Close / Dismiss Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. Register New Customer Member Modal */}
      {isNewCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Register Loyalty Member</h3>
                  <p className="text-xs text-slate-500">PRODX Customer Rewards Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center gap-3">
              <Award className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-bold">Welcome Privilege:</span> New members automatically receive <span className="font-mono font-bold">50 Welcome Points</span> (฿50 discount value) upon registration!
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer Name</label>
                <input
                  type="text"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g. Somchai Srisuk"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="0819987766"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsNewCustomerModalOpen(false)}
                className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRegisterCustomer}
                disabled={isRegisteringCustomer || !newCustomerName.trim() || !newCustomerPhone.trim()}
                className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all text-xs uppercase shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isRegisteringCustomer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Register & Apply</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Inter-Store Inventory Transfer & Dispatch Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Inter-Store Stock Transfer</h3>
                  <p className="text-xs text-slate-500">Multi-Branch Inventory Balancing & Logistics</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Source Branch (From)</label>
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>BKK-FLAGSHIP-01 (Current)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Destination Branch (To)</label>
                <select
                  value={transferDestStore}
                  onChange={(e) => setTransferDestStore(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                >
                  <option value="BKK-SILOM-02">BKK-SILOM-02 (Silom Hub)</option>
                  <option value="BKK-SIAM-03">BKK-SIAM-03 (Siam Center)</option>
                  <option value="BKK-SUKHUMVIT-04">BKK-SUKHUMVIT-04 (Thonglor)</option>
                </select>
              </div>
            </div>

            {/* Product selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Product to Transfer</label>
              <select
                value={transferProductId || (products[0]?.id || '')}
                onChange={(e) => setTransferProductId(e.target.value)}
                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
              >
                {products.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    [{prod.sku}] {prod.nameEn} — Available: {prod.stock} units
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity & Quick Steppers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transfer Quantity</label>
                <div className="flex gap-1.5">
                  {[5, 10, 20, 50].map((step) => (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setTransferQty(step.toString())}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold rounded text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      +{step}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min={1}
                value={transferQty}
                onChange={(e) => setTransferQty(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-lg font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            {/* Reason */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transfer Reason / Authorization</label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Stock balancing across stores"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            {/* Supervisor PIN */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Supervisor PIN Required</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setTransferSupervisorPin('2580')}
                    className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    2580 (Sup)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferSupervisorPin('9999')}
                    className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                  >
                    9999 (Mgr)
                  </button>
                </div>
              </div>
              <input
                type="password"
                maxLength={4}
                value={transferSupervisorPin}
                onChange={(e) => setTransferSupervisorPin(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-base font-mono font-bold tracking-[0.5em] text-slate-900 dark:text-white"
              />
            </div>

            {/* Recent Transfer History in Drawer */}
            {transferHistory.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent In-Transit Dispatches</div>
                <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                  {transferHistory.slice(0, 5).map((trf) => (
                    <div key={trf.id} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{trf.productName || trf.sku}</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">x{trf.qty}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {trf.sourceStoreId} → {trf.destinationStoreId}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-mono font-bold">
                        {trf.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!transferProductId && products.length > 0) {
                    setTransferProductId(products[0].id);
                  }
                  handleExecuteTransfer();
                }}
                disabled={isExecutingTransfer || !transferSupervisorPin}
                className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all text-xs uppercase shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isExecutingTransfer ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                <span>Dispatch Transfer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Direct Supplier Restock PO Modal */}
      {isRestockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Direct Supplier Restock (PO)</h3>
                  <p className="text-xs text-slate-500">Fast Automated Stock Replenishment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Product Info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Product Details</div>
              {(() => {
                const target = products.find(p => p.id === restockProductId) || products[0];
                return target ? (
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{target.nameEn} ({target.nameTh})</div>
                    <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-1">
                      <span>SKU: {target.sku}</span>
                      <span>·</span>
                      <span className={target.stock <= target.lowStockThreshold ? 'text-amber-500 font-bold' : ''}>
                        Current Stock: {target.stock} units
                      </span>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Restock Quantity</label>
                <div className="flex gap-1.5">
                  {[20, 50, 100].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setRestockQty(qty.toString())}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-mono font-bold rounded text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                min={1}
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center text-xl font-mono font-bold text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestock}
                disabled={isExecutingRestock || !restockProductId}
                className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition-all text-xs uppercase shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isExecutingRestock ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>Confirm Restock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Predictive Sales & Shelf Velocity Analytics Modal */}
      {isAnalyticsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Shelf Velocity & Peak Sales Analytics</h3>
                  <p className="text-xs text-slate-500">Real-Time Gross Margin & Shift Demand Forecasting</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchShelfAnalytics}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Refresh Analytics"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingAnalytics ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnalyticsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            {shelfAnalytics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Revenue</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    ฿{((shelfAnalytics.grossProfitSummary.totalRevenueSatang || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-500 font-bold">Shift Topline</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cost of Goods (COGS)</div>
                  <div className="text-lg font-black font-mono text-slate-900 dark:text-white">
                    ฿{((shelfAnalytics.grossProfitSummary.totalCostSatang || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Direct Inventory Cost</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Net Gross Profit</div>
                  <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ฿{((shelfAnalytics.grossProfitSummary.totalGrossProfitSatang || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-emerald-500 font-bold">Post-COGS Net</div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Overall Margin</div>
                  <div className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                    {shelfAnalytics.grossProfitSummary.overallMarginPercent || 0}%
                  </div>
                  <div className="text-[10px] text-indigo-500 font-bold">Weighted Blend</div>
                </div>
              </div>
            )}

            {/* Peak Hours Timeline Chart */}
            {shelfAnalytics && (
              <div className="p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Peak Traffic & Rush Hours (07:00 – 21:00)
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Highest Volume Alert: <span className="text-amber-500 font-bold">12:00 & 18:00</span>
                  </div>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-15 gap-1.5 pt-2">
                  {shelfAnalytics.peakHours.map((ph) => {
                    return (
                      <div key={ph.hour} className="flex flex-col items-center gap-1.5">
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-lg h-16 flex items-end p-1 justify-center relative group">
                          <div
                            style={{ height: `${Math.min(100, Math.max(12, ph.ordersCount * 25))}%` }}
                            className={`w-full rounded-md transition-all ${
                              ph.ordersCount > 1
                                ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-md'
                                : ph.ordersCount === 1
                                ? 'bg-emerald-500/50'
                                : 'bg-transparent'
                            }`}
                          />
                          {ph.ordersCount > 0 && (
                            <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono pointer-events-none whitespace-nowrap z-10 shadow-lg">
                              ฿{(ph.totalSalesSatang / 100).toFixed(0)} ({ph.ordersCount} tx)
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-400">{ph.hourLabel}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fast-Moving Shelf Velocity Table */}
            {shelfAnalytics && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Fast-Moving Shelf Velocity Ranking
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Sorted by Units Sold</span>
                </div>

                <div className="border border-slate-200/60 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/70 dark:bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200/60 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Rank / Product</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3 text-right">Units Sold</th>
                          <th className="px-4 py-3 text-right">Gross Revenue</th>
                          <th className="px-4 py-3 text-right">Gross Margin</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {shelfAnalytics.topSellers.map((item, index) => {
                          const catalogProd = products.find(p => p.id === item.productId);
                          const isLowStock = catalogProd && catalogProd.stock <= catalogProd.lowStockThreshold;

                          return (
                            <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/50 transition-colors">
                              <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                  index === 0 ? 'bg-amber-400 text-slate-950' :
                                  index === 1 ? 'bg-slate-300 text-slate-800' :
                                  index === 2 ? 'bg-amber-700/20 text-amber-700 dark:text-amber-400' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}>
                                  {index + 1}
                                </span>
                                <div>
                                  <div>{item.nameEn}</div>
                                  {isLowStock && (
                                    <span className="text-[9px] text-rose-500 font-bold uppercase">
                                      Low Stock Alert ({catalogProd.stock} left)
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{item.category}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">{item.unitsSold} units</td>
                              <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                ฿{(item.revenueSatang / 100).toFixed(2)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono">
                                <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                  item.marginPercent >= 60 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {item.marginPercent}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRestockProductId(item.productId);
                                    setIsRestockModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-900 dark:bg-slate-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Restock PO
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsAnalyticsModalOpen(false)}
                className="w-full px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase cursor-pointer"
              >
                Close Analytics Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Fiscal Full Tax Invoice (E-Tax) Modal & Printable Document */}
      {taxInvoiceModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
            {!taxInvoicePreview ? (
              // Form to enter Tax ID, Company name, address
              <>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        Issue Official Full Tax Invoice (ใบกำกับภาษีเต็มรูป)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Thai Revenue Department Compliant Fiscal E-Tax Engine
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTaxInvoiceModalOrder(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Reference Sale: </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{taxInvoiceModalOrder.orderNumber}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Grand Total: </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ฿{(taxInvoiceModalOrder.totalSatang / 100).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Company / Customer Name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Company Name / Full Name (ชื่อผู้ซื้อ / นิติบุคคล) *
                    </label>
                    <input
                      type="text"
                      value={taxCustomerName}
                      onChange={(e) => setTaxCustomerName(e.target.value)}
                      placeholder="e.g. บริษัท สยามนวัตกรรมรีเทล จำกัด"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                    />
                  </div>

                  {/* 13-Digit Tax ID */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        13-Digit Tax ID (เลขประจำตัวผู้เสียภาษีอากร 13 หลัก) *
                      </label>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setTaxIdInput('0105558098765')}
                          className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-300 font-bold cursor-pointer"
                        >
                          Fill 0105558098765
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      maxLength={13}
                      value={taxIdInput}
                      onChange={(e) => setTaxIdInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="0105558098765"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold tracking-widest text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>

                  {/* Branch Type & Number */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Establishment (สถานประกอบการ)
                      </label>
                      <select
                        value={taxBranchType}
                        onChange={(e) => setTaxBranchType(e.target.value as any)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
                      >
                        <option value="HEAD_OFFICE">สำนักงานใหญ่ (Head Office)</option>
                        <option value="BRANCH">สาขา (Branch)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Branch No. (รหัสสาขา 5 หลัก)
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        disabled={taxBranchType === 'HEAD_OFFICE'}
                        value={taxBranchType === 'HEAD_OFFICE' ? '00000' : taxBranchNumber}
                        onChange={(e) => setTaxBranchNumber(e.target.value)}
                        placeholder="00001"
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Address */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Registered Tax Address (ที่อยู่ตามทะเบียนภาษี) *
                    </label>
                    <textarea
                      rows={2}
                      value={taxAddress}
                      onChange={(e) => setTaxAddress(e.target.value)}
                      placeholder="e.g. 123/45 ถนนสีลม แขวงสุริยวาส เขตบางรัก กรุงเทพฯ 10500"
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none font-medium"
                    />
                  </div>

                  {/* Tax Breakdown Preview */}
                  <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/50 dark:border-indigo-900/40 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>มูลค่าสินค้าก่อนภาษี (Pre-VAT Base):</span>
                      <span className="font-mono">฿{(Math.round(taxInvoiceModalOrder.totalSatang / 1.07) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>ภาษีมูลค่าเพิ่ม 7% (VAT 7%):</span>
                      <span className="font-mono">
                        ฿{((taxInvoiceModalOrder.totalSatang - Math.round(taxInvoiceModalOrder.totalSatang / 1.07)) / 100).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-indigo-200/40 dark:border-indigo-800/40">
                      <span>จำนวนเงินรวมทั้งสิ้น (Grand Total):</span>
                      <span className="font-mono text-indigo-600 dark:text-indigo-400">
                        ฿{(taxInvoiceModalOrder.totalSatang / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setTaxInvoiceModalOrder(null)}
                    className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs uppercase cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleIssueTaxInvoice}
                    disabled={isIssuingTaxInvoice || !taxCustomerName.trim() || !taxIdInput.trim() || !taxAddress.trim()}
                    className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all text-xs uppercase shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isIssuingTaxInvoice ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>Issue E-Tax Invoice</span>
                  </button>
                </div>
              </>
            ) : (
              // Official Printable Tax Invoice Layout
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Official Fiscal Tax Invoice Generated</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Document</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTaxInvoicePreview(null);
                        setTaxInvoiceModalOrder(null);
                      }}
                      className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Printable Document Box */}
                <div className="p-6 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl space-y-5 font-sans text-slate-900 dark:text-white shadow-inner">
                  {/* Header Title */}
                  <div className="text-center space-y-1 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-black tracking-tight uppercase">
                      ใบกำกับภาษี / ใบเสร็จรับเงิน
                    </h2>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">
                      TAX INVOICE / RECEIPT
                    </div>
                  </div>

                  {/* Seller & Invoice Meta */}
                  <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="font-bold text-sm">บริษัท โปรดีเอ็กซ์ คลาวด์ รีเทล จำกัด</div>
                      <div className="text-slate-500">เลขประจำตัวผู้เสียภาษีอากร: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">0105566012345</span></div>
                      <div className="text-slate-500">สถานประกอบการ: <span className="font-bold">สำนักงานใหญ่ (00000)</span></div>
                      <div className="text-slate-500">888 อาคารเพลินจิตเซ็นเตอร์ ชั้น 12 ถนนสุขุมวิท คลองเตย กรุงเทพฯ 10110</div>
                      <div className="text-slate-400 font-mono text-[10px]">POS ID: {taxInvoicePreview.posMachineId}</div>
                    </div>

                    <div className="text-right space-y-1 font-mono">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">เลขที่ใบกำกับภาษี / INVOICE NO.</div>
                      <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">{taxInvoicePreview.invoiceNumber}</div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold pt-1">วันที่ออกเอกสาร / DATE</div>
                      <div className="text-slate-700 dark:text-slate-300 text-xs">
                        {new Date(taxInvoicePreview.issuedAt).toLocaleDateString('th-TH')} {new Date(taxInvoicePreview.issuedAt).toLocaleTimeString('th-TH')}
                      </div>
                    </div>
                  </div>

                  {/* Buyer Section */}
                  <div className="space-y-1 text-xs pb-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ข้อมูลผู้ซื้อ / CUSTOMER INFO</div>
                    <div className="font-bold text-sm">{taxInvoicePreview.customerName}</div>
                    <div className="text-slate-600 dark:text-slate-400">
                      เลขประจำตัวผู้เสียภาษีอากร: <span className="font-mono font-bold text-slate-900 dark:text-white">{taxInvoicePreview.taxId}</span>
                      <span className="mx-2">·</span>
                      สถานประกอบการ: <span className="font-bold">{taxInvoicePreview.branchType === 'HEAD_OFFICE' ? 'สำนักงานใหญ่' : `สาขาที่ ${taxInvoicePreview.branchNumber}`}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">{taxInvoicePreview.address}</div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                          <th className="py-2">ลำดับ</th>
                          <th className="py-2">รายการ (Description)</th>
                          <th className="py-2 text-right">จำนวน</th>
                          <th className="py-2 text-right">ราคา/หน่วย</th>
                          <th className="py-2 text-right">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
                        {taxInvoiceModalOrder.items.map((item, index) => (
                          <tr key={index}>
                            <td className="py-2 font-mono text-slate-400">{index + 1}</td>
                            <td className="py-2 font-medium">{item.nameTh}</td>
                            <td className="py-2 text-right font-mono">{item.qty}</td>
                            <td className="py-2 text-right font-mono">฿{(item.unitPriceSatang / 100).toFixed(2)}</td>
                            <td className="py-2 text-right font-mono font-bold">฿{(item.lineTotalSatang / 100).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Calculations */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs max-w-xs ml-auto font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>มูลค่าสินค้าก่อนภาษี:</span>
                      <span>฿{(taxInvoicePreview.preTaxSatang / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>ภาษีมูลค่าเพิ่ม 7% (VAT):</span>
                      <span>฿{(taxInvoicePreview.vatSatang / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-slate-800">
                      <span>จำนวนเงินรวมทั้งสิ้น:</span>
                      <span className="text-indigo-600 dark:text-indigo-400">
                        ฿{(taxInvoicePreview.totalSatang / 100).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Verification Stamp */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span>E-TAX VALIDATION CODE: {taxInvoicePreview.verificationCode}</span>
                    </div>
                    <span>ISSUED BY PRODX FISCAL ENGINE</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTaxInvoicePreview(null);
                      setTaxInvoiceModalOrder(null);
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl text-xs uppercase cursor-pointer"
                  >
                    Done / Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Cart Floating Action Bar */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0, scale: 0.95, x: '-50%' }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: 1,
              transition: { type: 'spring', stiffness: 260, damping: 20 } 
            }}
            exit={{ y: 80, opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className="xl:hidden fixed bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-md z-40"
          >
            <button
              onClick={() => setIsMobileCartOpen(true)}
              className="w-full bg-emerald-950/90 backdrop-blur-xl border border-emerald-500/30 text-white p-4 rounded-3xl shadow-[0_20px_40px_rgba(6,78,59,0.4)] flex items-center justify-between group active:scale-[0.97] transition-all overflow-hidden relative"
            >
              {/* Pulsing glow background decoration */}
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-emerald-400/5 to-transparent animate-pulse" />
              
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="relative">
                  <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-[0_4px_12px_rgba(16,185,129,0.3)] flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 animate-bounce" />
                  </div>
                  <motion.span 
                    key={cart.reduce((s, i) => s + i.qty, 0)}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-white text-emerald-900 text-[10px] flex items-center justify-center rounded-full font-black shadow-lg border border-emerald-100"
                  >
                    {cart.reduce((s, i) => s + i.qty, 0)}
                  </motion.span>
                </div>
                <div className="text-left space-y-0.5">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-300/80">Review Order</div>
                  <div className="text-xs font-black text-white/90">
                    {cart.length} Item{cart.length > 1 ? 's' : ''} Selected
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-3.5 relative z-10">
                <div className="text-right space-y-0.5">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-emerald-400 font-bold">Payable Total</div>
                  <div className="text-base font-black font-mono tabular-nums text-emerald-300">
                    ฿{(financials.totalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="w-9 h-9 bg-emerald-500/20 group-hover:bg-emerald-500 text-emerald-300 group-hover:text-white rounded-2xl flex items-center justify-center transition-all duration-300 border border-emerald-500/20 shadow-inner">
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Cart Drawer Overlay */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileCartOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[50] xl:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-[51] bg-white rounded-t-[2.5rem] shadow-2xl xl:hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-xl text-slate-900">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Review Order</h2>
                </div>
                <button 
                  onClick={() => setIsMobileCartOpen(false)}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Cart Items List */}
                <div className="space-y-4">
                  {cart.map((item, idx) => (
                    <div key={`${item.product.id}-${idx}`} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0 border border-slate-200">
                        <img src={CATEGORY_IMAGES[item.product.category]} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">{item.product.nameEn}</div>
                        <div className="text-xs text-slate-600 font-mono tabular-nums">
                          {formatSatangToThb(item.product.priceSatang)}
                        </div>
                      </div>
                      <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200">
                        <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><Minus className="w-4 h-4 text-slate-700" /></button>
                        <span className="w-8 text-center text-sm font-bold font-mono text-slate-900">{item.qty}</span>
                        <button onClick={() => addToCart(item.product)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><Plus className="w-4 h-4 text-slate-700" /></button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals & Controls */}
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Payment</label>
                      <select 
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-bold text-slate-900"
                      >
                        <option value="PROMPTPAY_QR">QR Code</option>
                        <option value="CASH">Cash</option>
                        <option value="CREDIT_CARD">Credit Card</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Discount</label>
                      <input
                        type="number"
                        value={discountThbInput}
                        onChange={(e) => setDiscountThbInput(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-mono font-bold text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white rounded-3xl p-6 space-y-4 shadow-xl">
                    <div className="flex justify-between items-center opacity-60">
                      <span className="text-xs font-bold uppercase tracking-widest">Subtotal</span>
                      <span className="font-mono text-sm">{formatSatangToThb(financials.subtotalSatang)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-400">
                      <span className="text-xs font-bold uppercase tracking-widest">Discount</span>
                      <span className="font-mono text-sm">-{formatSatangToThb(financials.discountSatang)}</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60 text-white">Total Amount</span>
                        <div className="text-3xl font-black font-mono tabular-nums tracking-tighter">
                          ฿{(financials.totalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          handleCheckout();
                          setIsMobileCartOpen(false);
                        }}
                        disabled={submitting}
                        className="p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
                      >
                        {submitting ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Printer className="w-6 h-6" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick Actions Floating Menu */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
        <AnimatePresence>
          {quickMenuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-2xl flex flex-col gap-2 min-w-[260px] max-w-sm"
            >
              <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1 flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Quick Terminal Actions</span>
                {heldOrders.length > 0 && (
                  <span className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[9px] font-black font-mono">
                    {heldOrders.length} Held
                  </span>
                )}
              </div>

              {/* Action 1: Hold Order */}
              <button
                onClick={() => {
                  handleHoldOrder();
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                  <Pause className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Hold Current Order</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Suspend active cart items</div>
                </div>
              </button>

              {/* Action 2: Recall Order List (or status) */}
              {heldOrders.length > 0 ? (
                <div className="space-y-1.5 p-1 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <div className="px-2 pt-1 text-[9px] font-extrabold text-amber-600 dark:text-amber-500 uppercase tracking-wider">
                    Recall Held Orders:
                  </div>
                  <div className="max-h-[140px] overflow-y-auto space-y-1 no-scrollbar pr-1">
                    {heldOrders.map((h, idx) => (
                      <button
                        key={`${h.id}-${idx}`}
                        onClick={() => {
                          handleRecallOrder(h.id);
                          setQuickMenuOpen(false);
                        }}
                        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-left text-xs font-bold text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-800/80 bg-white dark:bg-slate-900 transition-all cursor-pointer shadow-sm hover:border-emerald-500/40"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FolderOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="font-mono tracking-tight text-[11px] truncate">{h.id}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono shrink-0">{h.heldAt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed"
                >
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg shrink-0">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">Recall Held Order</div>
                    <div className="text-[9px] truncate">No suspended orders found</div>
                  </div>
                </button>
              )}

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              {/* Action 3: Print Last Receipt */}
              <button
                onClick={() => {
                  handlePrintLastReceipt();
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <Printer className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Print Last Receipt</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Preview/Print most recent sale</div>
                </div>
              </button>

              {/* Action 4: Toggle Drawer */}
              <button
                onClick={() => {
                  handleToggleDrawer();
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className={`p-2 rounded-lg shrink-0 ${isDrawerOpen ? 'bg-rose-500/10 text-rose-600' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                  {isDrawerOpen ? <Unlock className="w-4 h-4 animate-bounce" /> : <Lock className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Toggle Cash Drawer</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                    Status: <span className={isDrawerOpen ? 'text-rose-600 font-bold animate-pulse' : 'text-slate-500 font-medium'}>
                      {isDrawerOpen ? 'OPEN (UNLOCKED)' : 'LOCKED'}
                    </span>
                  </div>
                </div>
              </button>

              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />

              {/* Action 5: Inter-Store Stock Transfer */}
              <button
                onClick={() => {
                  setIsTransferModalOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <Truck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Inter-Store Transfer</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Dispatch inventory across branches</div>
                </div>
              </button>

              {/* Action 6: Shelf Analytics */}
              <button
                onClick={() => {
                  fetchShelfAnalytics();
                  setIsAnalyticsModalOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Shelf Velocity & Analytics</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Peak hours & fast-moving items</div>
                </div>
              </button>

              {/* Action 7: New Loyalty Member */}
              <button
                onClick={() => {
                  setIsNewCustomerModalOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Register Member</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">+50 Welcome Points signup</div>
                </div>
              </button>

              {/* Action 8: WebAuthn Supervisor Biometrics */}
              <button
                onClick={() => {
                  setIsBiometricConsoleOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold">Biometric Console</div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">WebAuthn Touch ID / Face ID</div>
                </div>
              </button>

              {/* Action 9: AI Stockout Radar & Runout Predictions */}
              <button
                onClick={() => {
                  setIsStockPredictionModalOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Stockout Radar</span>
                    {products.filter(p => p.stock <= p.lowStockThreshold).length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Days-to-Stockout & Reorder AI</div>
                </div>
              </button>

              {/* Action 10: Customer Display (Presentation API) */}
              <button
                onClick={() => {
                  setIsCustomerDisplayModalOpen(true);
                  setQuickMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-left text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
              >
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
                  <Tv className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <span>Customer Display</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isCustomerDisplayConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Dual Monitor / Cast Display</div>
                </div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Floating Trigger Button */}
        <motion.button
          onClick={() => setQuickMenuOpen(!quickMenuOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center border transition-all cursor-pointer ${
            quickMenuOpen
              ? 'bg-slate-900 text-white border-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.3)]'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500/20 shadow-[0_10px_30px_rgba(5,150,105,0.3)]'
          }`}
          title="Terminal Quick Actions"
        >
          {quickMenuOpen ? (
            <X className="w-6 h-6 rotate-90 transition-transform duration-300" />
          ) : (
            <div className="relative">
              <Zap className="w-6 h-6 animate-pulse" />
              {heldOrders.length > 0 && (
                <span className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center shadow-lg border border-white dark:border-slate-900 animate-bounce">
                  {heldOrders.length}
                </span>
              )}
            </div>
          )}
        </motion.button>
      </div>

      {/* Status Banner Toast */}
      {statusBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-lg px-4 animate-in slide-in-from-top-12 duration-500">
          <div className={`flex items-center justify-between p-4 rounded-2xl border shadow-2xl ${
            statusBanner.type === 'SUCCESS' ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-white border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-3">
              {statusBanner.type === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
              <span className="text-sm font-bold tracking-tight">{statusBanner.text}</span>
            </div>
            <button onClick={() => setStatusBanner(null)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Flying Add-To-Cart Bubbles (B1) */}
      <AnimatePresence>
        {flyingBubbles.map((bubble) => (
          <motion.div
            key={bubble.id}
            initial={{ x: bubble.startX, y: bubble.startY, scale: 1.2, opacity: 1 }}
            animate={{
              x: window.innerWidth - 320, // Targets general Sidebar cart layout coordinate
              y: 180, // Height near sidebar head
              scale: 0.2,
              opacity: [1, 0.9, 0],
            }}
            transition={{
              type: 'spring',
              stiffness: 140,
              damping: 18,
              mass: 1.2,
            }}
            className="fixed z-[100] pointer-events-none px-3 py-1.5 bg-emerald-600 text-white text-xs font-black rounded-full shadow-lg border border-emerald-400 font-sans tracking-tight"
          >
            {bubble.label}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 5. Standalone WebAuthn Supervisor Biometric Console Modal */}
      <BiometricAuthModal
        isOpen={isBiometricConsoleOpen}
        onClose={() => setIsBiometricConsoleOpen(false)}
        title="Supervisor Biometric Passkey Console"
        actionLabel="BIOMETRIC VERIFICATION"
        targetDescription="FIDO2 / WebAuthn Hardware Authenticator"
        onAuthorized={(authData) => {
          showSuccess(
            'Biometric Verified',
            `Supervisor ${authData.supervisorName} successfully authenticated with ${authData.method === 'WEBAUTHN_BIOMETRIC' ? 'WebAuthn biometric hardware' : 'supervisor PIN'}.`
          );
          setStatusBanner({
            type: 'SUCCESS',
            text: `Supervisor Verified: ${authData.supervisorName} (${authData.method === 'WEBAUTHN_BIOMETRIC' ? 'Touch ID/Face ID' : 'PIN'})`,
          });
          setIsBiometricConsoleOpen(false);
        }}
      />

      {/* 6. AI Stockout Prediction Radar Modal */}
      {isStockPredictionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-5xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <span>AI Stockout Prediction & Reorder Radar</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-bold">
                      Inventory AI
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Live Days-to-Stockout and Reorder Recommended calculations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockPredictionModalOpen(false)}
                className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <StockPredictionWidget
              products={products}
              orders={orders}
              onStockReplenished={onStockAdjusted}
            />
          </div>
        </div>
      )}

      {/* 7. Customer-Facing Display Presentation API Modal */}
      <CustomerDisplayModal
        isOpen={isCustomerDisplayModalOpen}
        onClose={() => setIsCustomerDisplayModalOpen(false)}
      />

      {/* 8. Quick Action Context Menu & Associated Modals */}
      <InventoryQuickActionController
        state={quickActions.state}
        onCloseMenu={quickActions.closeMenu}
        onCloseModal={quickActions.closeModal}
        onSelectAction={quickActions.openActionModal}
        onStockUpdated={onStockAdjusted}
      />

      {/* 9. Microphone-Based Voice Command Assistant Floating HUD & Recognition Bar */}
      <PosVoiceCommandBar
        isOpen={isVoiceCommandOpen}
        onClose={() => setIsVoiceCommandOpen(false)}
        products={products}
        cartCount={cart.length}
        onAddToCart={(product, quantity = 1) => addToCart(product, quantity)}
        onFinalizeOrder={handleCheckout}
        onSetPaymentMethod={(method) => setPaymentMethod(method)}
        onClearCart={() => setCart([])}
      />

      {/* 10. Batch Payment Mode - Grouped Orders Consolidated Checkout Modal */}
      <PosBatchPaymentModal
        isOpen={isBatchPaymentModalOpen}
        onClose={() => setIsBatchPaymentModalOpen(false)}
        orders={orders}
        onBatchCheckoutSuccess={(batchRecord) => {
          batchRecord.orderIds.forEach((id) => {
            const ord = orders.find((o) => o.id === id || o.orderNumber === id);
            if (ord) {
              ord.isBatchConsolidated = true;
              ord.batchPaymentId = batchRecord.id;
              ord.batchNumber = batchRecord.batchNumber;
            }
          });
          onOrderOverridden();
        }}
      />

      {/* 11. Automated Customer Receipt Batch Email Service Modal */}
      <PosBatchEmailServiceModal
        isOpen={isBatchEmailModalOpen}
        onClose={() => setIsBatchEmailModalOpen(false)}
        orders={orders}
        onOrdersUpdated={() => {
          onOrderOverridden();
        }}
      />

      {/* 12. Floating Numeric Keypad for Supervisor PIN Refunds */}
      {isFloatingKeypadOpen && (
        <SupervisorPinKeypad
          isFloating={true}
          title="Floating Supervisor Keypad"
          subtitle="Speed up entering supervisor PINs for refunds"
          errorMessage={floatingKeypadFeedback}
          supervisorNameHint={supervisorPin ? `Active: ${supervisorPin}` : undefined}
          onPinSubmit={(enteredPin) => {
            if (enteredPin === '1234' || enteredPin === '2580' || enteredPin === '9999') {
              setSupervisorPin(enteredPin);
              setFloatingKeypadFeedback(null);
              showSuccess(
                `Supervisor PIN (${enteredPin}) Authorized & Saved for Refunds`,
                'Supervisor Keypad'
              );
            } else {
              setFloatingKeypadFeedback('Invalid supervisor PIN. Use 2580, 1234, or 9999.');
              showGlobalError('Invalid supervisor PIN code.', 'PIN Authorization Error');
            }
          }}
          onCancel={() => setIsFloatingKeypadOpen(false)}
          onToggleFloating={() => setIsFloatingKeypadOpen(false)}
        />
      )}

      {/* 13. Receipt Print Queue & Thermal Spooler Modal */}
      <ReceiptPrintQueueModal
        isOpen={isPrintQueueOpen}
        onClose={() => setIsPrintQueueOpen(false)}
        recentOrders={orders}
      />
    </div>
  );
};
