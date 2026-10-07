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
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60 overflow-x-auto no-scrollbar scroll-smooth">
            {['ALL', 'COFFEE', 'BEVERAGE', 'BAKERY', 'MERCHANDISE'].map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  {cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or scan SKU..."
              className="w-full pl-11 pr-4 py-3 bg-slate-100 border-transparent rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600/30 transition-all text-slate-900 placeholder:text-slate-400"
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
              className="group flex flex-col text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:border-emerald-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="aspect-[4/3] bg-slate-50 relative overflow-hidden">
                <img
                  src={CATEGORY_IMAGES[p.category] || '/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg'}
                  alt={p.nameEn}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 px-2 py-1 bg-white/90 backdrop-blur rounded-lg text-[10px] font-bold text-slate-900 shadow-sm uppercase tracking-tight">
                  {p.category}
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {p.nameEn}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                    <span className="font-mono">{p.sku}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`${p.stock <= p.lowStockThreshold ? 'text-amber-600 font-bold' : ''} font-mono tabular-nums`}>
                      {p.stock} units
                    </span>
                  </div>
                </div>
                <div className="flex items-baseline gap-1 mt-auto">
                  <span className="text-sm font-bold font-mono text-emerald-600">฿</span>
                  <span className="text-lg font-extrabold text-slate-900 font-mono tabular-nums tracking-tight">
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
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-xl">
                <ShoppingBag className="w-5 h-5 text-slate-900" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Current Order</h2>
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest font-mono tabular-nums">
              {cart.reduce((s, i) => s + i.qty, 0)} Items
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto py-6 space-y-4 no-scrollbar max-h-[300px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30 py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-600">Cart is empty</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="flex items-center gap-4 group">
                  <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200">
                    <img src={CATEGORY_IMAGES[item.product.category]} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{item.product.nameEn}</div>
                    <div className="text-[11px] text-slate-600 font-mono tabular-nums">
                      {formatSatangToThb(item.product.priceSatang)} × {item.qty}
                    </div>
                  </div>
                  <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                    <button onClick={() => updateCartQty(item.product.id, -1)} className="p-1 hover:bg-white rounded-md transition-colors"><Minus className="w-3 h-3 text-slate-700" /></button>
                    <span className="w-8 text-center text-xs font-bold font-mono text-slate-900">{item.qty}</span>
                    <button onClick={() => addToCart(item.product)} className="p-1 hover:bg-white rounded-md transition-colors"><Plus className="w-3 h-3 text-slate-700" /></button>
                  </div>
                  <button onClick={() => updateCartQty(item.product.id, -item.qty)} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Remove Item">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Checkout UI */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            {/* Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
                {[
                  { id: 'PROMPTPAY_QR', icon: QrCode, label: 'QR' },
                  { id: 'CREDIT_CARD', icon: CreditCard, label: 'Card' },
                  { id: 'CASH', icon: Banknote, label: 'Cash' },
                ].map((m) => {
                  const isActive = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60 font-bold'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-white/60'
                      }`}
                    >
                      <m.icon className="w-3.5 h-3.5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Discount (THB)</label>
                  <input
                    type="number"
                    value={discountThbInput}
                    onChange={(e) => setDiscountThbInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Digital Receipt</span>
                    <input
                      type="checkbox"
                      checked={sendDigitalReceipt}
                      onChange={(e) => setSendDigitalReceipt(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                  {sendDigitalReceipt && (
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="Customer Email"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:bg-white transition-all"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Subtotal</span>
                <span className="font-mono text-slate-800 tabular-nums text-sm font-medium">
                  {formatSatangToThb(financials.subtotalSatang)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-amber-600 tracking-wider uppercase">Discount</span>
                <span className="font-mono text-amber-600 tabular-nums text-sm font-medium">
                  -{formatSatangToThb(financials.discountSatang)}
                </span>
              </div>
              
              <div className="h-px bg-slate-200/80 my-2" />

              <div className="flex flex-col gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">TOTAL PAYABLE</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-slate-400 text-lg font-sans">฿</span>
                    <span className="text-2xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tighter">
                      {(financials.totalSatang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={submitting || cart.length === 0}
                  className={`w-full py-4 px-4 flex items-center justify-center gap-2 uppercase text-xs font-bold tracking-widest rounded-xl transition-all active:scale-[0.98] ${
                    submitting || cart.length === 0
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed font-semibold'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'
                  }`}
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
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Transaction Ledger</h2>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified & Audit Chain Secure
            </p>
          </div>
          <button onClick={fetchReceiptHistory} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><RefreshCw className="w-4 h-4" /></button>
        </div>

        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                <th className="py-6 px-4">Order ID</th>
                <th className="py-6 px-4">Time</th>
                <th className="py-6 px-4">Items</th>
                <th className="py-6 px-4">Method</th>
                <th className="py-6 px-4 text-right">Total</th>
                <th className="py-6 px-4 text-center">Status</th>
                <th className="py-6 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice().reverse().slice(0, 10).map((ord) => (
                <tr key={ord.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 font-mono font-bold text-slate-900">{ord.orderNumber}</td>
                  <td className="py-4 px-4 text-xs text-slate-500 font-medium font-mono">
                    {new Date(ord.createdAt).toLocaleTimeString('en-US', { hour12: false })}
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-xs text-slate-600 font-medium truncate max-w-xs">
                      {ord.items.map((i) => `${i.nameTh} x${i.qty}`).join(' · ')}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="text-[10px] font-black text-slate-400 uppercase border border-slate-200 px-1.5 py-0.5 rounded font-mono">
                      {ord.paymentMethod}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right font-bold font-mono tabular-nums text-slate-900">
                    {formatSatangToThb(ord.totalSatang)}
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`text-[10px] font-bold uppercase ${ord.status === 'COMPLETED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="inline-flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setReceiptPreviewModal(ord)} className="p-2 text-slate-400 hover:text-slate-900"><Eye className="w-4 h-4" /></button>
                      <button 
                        onClick={() => setEmailConfirmModal({ order: ord, recipientEmail: customerEmail || 'customer@example.com' })} 
                        className="p-2 text-slate-400 hover:text-sky-600"
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
          <div className="bg-white rounded-[2rem] max-w-md w-full p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8" />
              </div>
              <h4 className="text-xl font-black text-slate-900 tracking-tight">Send Digital Receipt</h4>
              <p className="text-sm text-slate-500 font-medium">Recipient: <span className="font-bold text-slate-900">{emailConfirmModal.recipientEmail}</span></p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-400">
                <span>Total Amount</span>
                <span className="text-slate-900 font-mono tabular-nums">{formatSatangToThb(emailConfirmModal.order.totalSatang)}</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEmailConfirmModal(null)} className="flex-1 px-6 py-4 bg-slate-100 text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={executeSendEmail} className="flex-1 px-6 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95">
                <Send className="w-4 h-4" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Cart Action Pill */}
      <div className="xl:hidden fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="bg-white border border-slate-200 text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            {cart.length > 0 && (
              <span className="absolute -top-2 -right-2 w-3.5 h-3.5 bg-emerald-600 text-white text-[8px] flex items-center justify-center rounded-full animate-pulse font-mono tabular-nums">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </div>
          <span>Review Order</span>
        </button>
      </div>

      {/* Status Banner Toast */}
      {statusBanner && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] w-full max-lg px-4 animate-in slide-in-from-top-12 duration-500">
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
    </div>
  );
};
