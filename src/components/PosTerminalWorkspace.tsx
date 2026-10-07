import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { ProductItem, PosOrderRecord, formatSatangToThb } from '../types/prodx';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, logoutGmail } from '../lib/firebaseAuth';
import {
  sendDigitalReceiptEmail,
  generateReceiptHtml,
  SentReceiptRecord,
} from '../lib/gmailReceiptService';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [discountThbInput, setDiscountThbInput] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD'>('PROMPTPAY_QR');
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState<string>(
    () => `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  );
  const [submitting, setSubmitting] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: 'SUCCESS' | 'REPLAY' | 'ERROR';
    text: string;
  } | null>(null);

  // Gmail State
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [sendDigitalReceipt, setSendDigitalReceipt] = useState<boolean>(false);
  const [gmailUser, setGmailUser] = useState<User | null>(null);
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

  const handleGmailSignIn = async () => {
    setIsLoggingInGmail(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailUser(result.user);
        setGmailToken(result.accessToken);
      }
    } finally {
      setIsLoggingInGmail(false);
    }
  };

  const financials = useMemo(() => {
    const subtotalSatang = cart.reduce((acc, c) => acc + (c.product.priceSatang || 0) * c.qty, 0);
    const parsedDiscountSatang = Math.max(0, Math.round((parseFloat(discountThbInput) || 0) * 100));
    const discountSatang = Math.min(subtotalSatang, parsedDiscountSatang);
    const netSatang = subtotalSatang - discountSatang;
    const vatSatang = Math.round(netSatang * 0.07);
    const totalSatang = netSatang + vatSatang;

    return { subtotalSatang, discountSatang, vatSatang, totalSatang };
  }, [cart, discountThbInput]);

  const addToCart = (product: ProductItem) => {
    setCart((prev) => {
      const found = prev.find((item) => item.product.id === product.id);
      if (found) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: Math.min(product.stock, item.qty + 1) } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
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

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((c) => ({ productId: c.product.id, qty: c.qty })),
          discountSatang: financials.discountSatang,
          paymentMethod,
          idempotencyKey: customIdempotencyKey,
          cashierName: 'System Admin',
        }),
      });
      const data = await response.json();
      if (response.ok) {
        onOrderCreated(data.order, data.idempotentReplay);
        setCart([]);
        setDiscountThbInput('0');
        setCustomIdempotencyKey(`idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);
        
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
    if (!emailConfirmModal || !gmailToken) return;
    try {
      const result = await sendDigitalReceiptEmail({
        order: emailConfirmModal.order,
        recipientEmail: emailConfirmModal.recipientEmail,
        accessToken: gmailToken,
      });
      if (result.ok) {
        setStatusBanner({ type: 'SUCCESS', text: 'Receipt sent successfully via Gmail' });
        setEmailConfirmModal(null);
        fetchReceiptHistory();
      }
    } catch (err) {
      console.error(err);
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
      {/* Left side: Catalog & Search */}
      <div className="xl:col-span-8 space-y-8">
        {/* Navigation & Search Zone */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 p-1 bg-zinc-100 rounded-full overflow-x-auto no-scrollbar scroll-smooth">
            {['ALL', 'COFFEE', 'BEVERAGE', 'BAKERY', 'MERCHANDISE'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-6 py-2 text-xs font-bold rounded-full transition-all whitespace-nowrap ${
                  selectedCategory === cat ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or scan SKU..."
              className="w-full pl-11 pr-4 py-3 bg-zinc-100 border-transparent rounded-full text-sm focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600/30 transition-all"
            />
          </div>
        </div>

        {/* Product Grid - Modern Minimart Style */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.stock <= 0}
              className="group flex flex-col text-left bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="aspect-[4/3] bg-zinc-50 relative overflow-hidden">
                <img
                  src={CATEGORY_IMAGES[p.category] || '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg'}
                  alt={p.nameEn}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-zinc-900 shadow-sm uppercase tracking-tight">
                  {p.category}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-zinc-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {p.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-medium">
                    <span>{p.sku}</span>
                    <span aria-hidden="true">·</span>
                    <span className={p.stock <= p.lowStockThreshold ? 'text-amber-600 font-bold' : ''}>
                      {p.stock} units
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-auto">
                  <span className="text-sm font-bold font-mono text-emerald-600">฿</span>
                  <span className="text-lg font-extrabold text-zinc-900 font-mono tabular-nums tracking-tight">
                    {formatSatangToThb(p.priceSatang).replace('฿', '').trim()}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right side: Persistent Cart & Checkout */}
      <div className="xl:col-span-4 space-y-6 sticky top-28">
        <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-100 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-zinc-900" />
              </div>
              <h2 className="text-lg font-bold text-zinc-900">Current Order</h2>
            </div>
            <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              {cart.reduce((s, i) => s + i.qty, 0)} Items
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar max-h-[300px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-zinc-100 rounded-xl overflow-hidden shrink-0 border border-zinc-200">
                    <img src={CATEGORY_IMAGES[item.product.category]} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-900 truncate">{item.product.nameEn}</div>
                    <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                      {formatSatangToThb(item.product.priceSatang)} × {item.qty}
                    </div>
                  </div>
                  <div className="flex items-center bg-zinc-100 rounded-lg p-0.5">
                    <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-white rounded-md transition-colors"><Minus className="w-3 h-3" /></button>
                    <span className="w-8 text-center text-xs font-bold font-mono">{item.qty}</span>
                    <button onClick={() => addToCart(item.product)} className="p-1 hover:bg-white rounded-md transition-colors"><Plus className="w-3 h-3" /></button>
                  </div>
                  <button onClick={() => updateCartQty(item.product.id, -item.qty)} className="p-2 text-zinc-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout UI */}
          <div className="pt-6 border-t border-zinc-100 space-y-6">
            {/* Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-1 bg-zinc-100 rounded-xl">
                {[
                  { id: 'PROMPTPAY_QR', icon: QrCode, label: 'QR' },
                  { id: 'CREDIT_CARD', icon: CreditCard, label: 'Card' },
                  { id: 'CASH', icon: Banknote, label: 'Cash' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                      paymentMethod === m.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">Discount (THB)</label>
                  <input
                    type="number"
                    value={discountThbInput}
                    onChange={(e) => setDiscountThbInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Digital Receipt</span>
                    <input
                      type="checkbox"
                      checked={sendDigitalReceipt}
                      onChange={(e) => setSendDigitalReceipt(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  {sendDigitalReceipt && (
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Customer Email"
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono focus:bg-white transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="space-y-3 bg-zinc-950 text-white p-6 rounded-2xl shadow-xl shadow-zinc-200 relative overflow-hidden border border-zinc-800">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] rounded-full" />
              <div className="flex justify-between items-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-zinc-300">{formatSatangToThb(financials.subtotalSatang)}</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-amber-500/80 uppercase tracking-widest">
                <span>Discount</span>
                <span className="font-mono tabular-nums">-{formatSatangToThb(financials.discountSatang)}</span>
              </div>
              <div className="pt-4 border-t border-white/5 flex justify-between items-end gap-4 relative z-10">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Payable</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-emerald-500">฿</span>
                    <span className="text-3xl font-black font-mono tabular-nums tracking-tighter text-white">
                      {formatSatangToThb(financials.totalSatang).replace('฿', '').trim()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={submitting || cart.length === 0}
                  className="flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/20 active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                >
                  <Printer className="w-5 h-5" />
                  <span>Execute Pay</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Account & Integrations Quick Control */}
        <div className="flex items-center justify-between p-4 bg-zinc-100 rounded-2xl border border-zinc-200/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${gmailToken ? 'bg-emerald-600/10 text-emerald-600' : 'bg-zinc-200 text-zinc-400'}`}>
              <Mail className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-bold uppercase tracking-tight">
              {gmailUser ? gmailUser.email : 'Gmail Integration'}
            </div>
          </div>
          {gmailUser ? (
            <button onClick={() => logoutGmail()} className="p-2 text-zinc-400 hover:text-red-500"><LogOut className="w-4 h-4" /></button>
          ) : (
            <button onClick={handleGmailSignIn} className="text-[10px] font-bold text-emerald-600 hover:underline uppercase tracking-widest">Connect</button>
          )}
        </div>
      </div>

      {/* History & Logs Section (Unboxed Table) */}
      <div className="xl:col-span-12 pt-12 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Transaction Ledger</h2>
            <p className="text-xs text-zinc-400 font-medium uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified & Audit Chain Secure
            </p>
          </div>
          <button onClick={fetchReceiptHistory} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>

        <div className="overflow-x-auto border-t border-zinc-100">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                <th className="py-6 px-4">Order ID</th>
                <th className="py-6 px-4">Time</th>
                <th className="py-6 px-4">Items</th>
                <th className="py-6 px-4">Method</th>
                <th className="py-6 px-4 text-right">Total</th>
                <th className="py-6 px-4 text-center">Status</th>
                <th className="py-6 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {orders.slice().reverse().slice(0, 10).map((ord) => (
                <tr key={ord.id} className="group hover:bg-zinc-50 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-zinc-900">{ord.orderNumber}</td>
                  <td className="py-4 px-4 text-xs text-zinc-500 font-medium">
                    {new Date(ord.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-xs text-zinc-600 font-medium truncate max-w-xs">
                      {ord.items.map((i) => `${i.nameTh} x${i.qty}`).join(' · ')}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] font-black text-zinc-400 uppercase border border-zinc-200 px-1.5 py-0.5 rounded">
                      {ord.paymentMethod}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold font-mono tabular-nums text-zinc-900">
                    {formatSatangToThb(ord.totalSatang)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-[10px] font-bold uppercase ${ord.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setReceiptPreviewModal(ord)} className="p-2 text-zinc-400 hover:text-zinc-900"><Eye className="w-4 h-4" /></button>
                      <button 
                        onClick={() => setEmailConfirmModal({ order: ord, recipientEmail: customerEmail || 'customer@example.com' })} 
                        className="p-2 text-zinc-400 hover:text-sky-600"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals - Simplified & Refined */}
      {receiptPreviewModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-8 flex items-center justify-between border-b border-zinc-100">
              <div className="space-y-1">
                <h4 className="text-xl font-black text-zinc-900 tracking-tight">Receipt Preview</h4>
                <p className="text-xs text-zinc-400 font-bold uppercase tracking-widest">{receiptPreviewModal.orderNumber}</p>
              </div>
              <button onClick={() => setReceiptPreviewModal(null)} className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 hover:bg-zinc-200 transition-all"><X className="w-6 h-6" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-zinc-50">
              <iframe title="Receipt" srcDoc={generateReceiptHtml(receiptPreviewModal)} className="w-full h-[500px] border border-zinc-200 rounded-2xl bg-white" />
            </div>
          </div>
        </div>
      )}

      {emailConfirmModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 space-y-6 shadow-2xl">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-black text-zinc-900 tracking-tight">Send Digital Receipt</h4>
              <p className="text-sm text-zinc-500 font-medium">Recipient: <span className="font-bold text-zinc-900">{emailConfirmModal.recipientEmail}</span></p>
            </div>
            <div className="bg-zinc-50 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-zinc-400">
                <span>Total Amount</span>
                <span className="text-zinc-900">{formatSatangToThb(emailConfirmModal.order.totalSatang)}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEmailConfirmModal(null)} className="flex-1 px-6 py-4 bg-zinc-100 text-zinc-900 font-bold rounded-2xl hover:bg-zinc-200 transition-all">Cancel</button>
              <button onClick={executeSendEmail} className="flex-1 px-6 py-4 bg-zinc-900 text-white font-bold rounded-2xl hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95">
                <Send className="w-4 h-4" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Action Button for Cart */}
      <button
        onClick={() => setIsMobileCartOpen(true)}
        className="xl:hidden fixed bottom-8 right-8 w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-90 transition-transform"
      >
        <ShoppingBag className="w-7 h-7" />
        {cart.length > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
            {cart.reduce((s, i) => s + i.qty, 0)}
          </div>
        )}
      </button>

      {/* Status Banner Toast */}
      {statusBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-w-lg px-4 animate-in slide-in-from-top-12 duration-500">
          <div className={`flex items-center justify-between p-4 rounded-2xl border shadow-2xl ${
            statusBanner.type === 'SUCCESS' ? 'bg-emerald-950 border-emerald-800 text-emerald-50' : 'bg-red-950 border-red-800 text-red-50'
          }`}>
            <div className="flex items-center gap-3">
              {statusBanner.type === 'SUCCESS' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
              <span className="text-sm font-bold tracking-tight">{statusBanner.text}</span>
            </div>
            <button onClick={() => setStatusBanner(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
};
