import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  QrCode,
  CreditCard,
  Banknote,
  Sparkles,
  CheckCircle2,
  Clock,
  Coffee,
  Crown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Tv,
  ArrowRight,
  ShieldCheck,
  Percent,
  Smartphone,
  Info,
  Layers,
  Heart,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CustomerDisplayState, DisplayPromotion } from '../types/customerDisplay';
import { presentationService, INITIAL_CUSTOMER_DISPLAY_STATE } from '../services/presentationService';
import { formatSatangToThb } from '../types/prodx';

interface CustomerFacingDisplayProps {
  isStandalone?: boolean;
  onClose?: () => void;
}

export const CustomerFacingDisplay: React.FC<CustomerFacingDisplayProps> = ({
  isStandalone = false,
  onClose,
}) => {
  const [displayState, setDisplayState] = useState<CustomerDisplayState>(INITIAL_CUSTOMER_DISPLAY_STATE);
  const [activePromoIndex, setActivePromoIndex] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [qrCountdownSeconds, setQrCountdownSeconds] = useState<number>(300);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Subscribe to live Presentation API / BroadcastChannel updates
  useEffect(() => {
    const unsubscribeState = presentationService.subscribe((newState) => {
      setDisplayState(newState);
    });

    const unsubscribeConn = presentationService.onConnectionChange((connected) => {
      setIsConnected(connected);
    });

    return () => {
      unsubscribeState();
      unsubscribeConn();
    };
  }, []);

  // Real-time clock timer
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-rotating promotional media carousel
  useEffect(() => {
    const promoCount = displayState.promotions?.length || 1;
    const interval = setInterval(() => {
      setActivePromoIndex((prev) => (prev + 1) % promoCount);
    }, 6000); // 6s per slide

    return () => clearInterval(interval);
  }, [displayState.promotions]);

  // QR Code countdown timer
  useEffect(() => {
    if (displayState.paymentMethod === 'PROMPTPAY_QR') {
      setQrCountdownSeconds(300);
      const timer = setInterval(() => {
        setQrCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 300));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [displayState.paymentMethod, displayState.financials.totalSatang]);

  // Fullscreen toggle handler
  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentPromo: DisplayPromotion | undefined =
    displayState.promotions[activePromoIndex] || displayState.promotions[0];

  const hasItems = displayState.cart && displayState.cart.length > 0;
  const isOrderCompleted = displayState.status === 'ORDER_COMPLETED' && displayState.completedOrder;

  // Format QR countdown as MM:SS
  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(qrCountdownSeconds / 60);
    const secs = qrCountdownSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [qrCountdownSeconds]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-hidden antialiased">
      {/* Top Banner: Store Brand, Register ID & Live Secondary Display Status */}
      <header className="h-16 px-6 sm:px-8 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
              <span>{displayState.storeName}</span>
              <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                CFD SECONDARY MONITOR
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              {displayState.branchName} • {displayState.terminalId} • {displayState.cashierName}
            </p>
          </div>
        </div>

        {/* Live Presentation Status, Clock & Fullscreen Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-300">LIVE SYNC ACTIVE</span>
          </div>

          <div className="text-right font-mono">
            <div className="text-sm font-black text-white tracking-wider">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">
              {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-4">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              title="Toggle Fullscreen Monitor Mode"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Secondary Display Canvas */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden relative">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: LIVE CART BREAKDOWN & TOTALS (7 of 12 cols on desktop)      */}
        {/* ========================================================================= */}
        <section className="lg:col-span-7 flex flex-col border-r border-slate-800/80 bg-slate-900/40 overflow-hidden relative">
          {/* Active Loyalty Customer Badge (If checked in) */}
          {displayState.activeCustomer && (
            <div className="px-6 py-3 bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-transparent border-b border-purple-800/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Crown className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-xs font-black text-white">
                    Welcome, {displayState.activeCustomer.name}
                  </span>
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {displayState.activeCustomer.tier} VIP
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono text-purple-300">
                Balance: <strong className="text-white font-bold">{displayState.activeCustomer.pointsBalance}</strong> pts
                <span className="text-emerald-400 ml-2 font-bold">
                  (+{displayState.financials.pointsToEarn} earned)
                </span>
              </div>
            </div>
          )}

          {/* Cart Header */}
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0 bg-slate-900/60">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Live Order Breakdown
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              {displayState.cart.reduce((s, it) => s + it.qty, 0)} Items Scanned
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {!hasItems ? (
              <div className="h-full flex flex-col justify-center p-6 space-y-6">
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ยินดีต้อนรับสู่ PRODX Coffee Bar &amp; Bakery</span>
                  </div>
                  <h3 className="text-xl font-black text-white">
                    รายการสินค้าขายดีประจำคลังสินค้า (Best Sellers)
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                    พร้อมเสิร์ฟความสดใหม่ทุกแก้ว อบสดใหม่ทุกวัน สั่งกับบาริสต้าได้ทันที
                  </p>
                </div>

                {/* Best Selling Products Showcase Grid */}
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto w-full">
                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800 relative">
                      <img
                        src="/src/assets/images/minimart_iced_latte_1791396408236.jpg"
                        alt="Iced Caramel Macchiato"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">อันดับ 1 กาแฟ</div>
                      <div className="text-xs font-bold text-white truncate">ไอซ์คาราเมลมัคคิอาโต้</div>
                      <div className="text-[11px] font-mono text-slate-300">฿115.00</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800 relative">
                      <img
                        src="/src/assets/images/minimart_croissant_butter_1791396420438.jpg"
                        alt="Artisan Croissant"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">อันดับ 1 เบเกอรี่</div>
                      <div className="text-xs font-bold text-white truncate">ครัวซองต์เนยสด AOP</div>
                      <div className="text-[11px] font-mono text-slate-300">฿95.00</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800 relative">
                      <img
                        src="/src/assets/images/minimart_bottled_water_premium_1791396432613.jpg"
                        alt="Premium Water"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">เมนูสุขภาพ</div>
                      <div className="text-xs font-bold text-white truncate">น้ำแร่ออแกนิกพรีเมียม</div>
                      <div className="text-[11px] font-mono text-slate-300">฿45.00</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-slate-800 relative">
                      <img
                        src="/src/assets/images/minimart_iced_latte_1791396408236.jpg"
                        alt="Uji Matcha Latte"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">ยอดนิยม</div>
                      <div className="text-xs font-bold text-white truncate">อูจิมัทฉะลาเต้โอ๊ตมิลค์</div>
                      <div className="text-[11px] font-mono text-slate-300">฿135.00</div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[11px] text-slate-500 font-mono">
                  สแกนชำระผ่าน PromptPay QR หรือแตะจ่ายได้ทันทีที่เครื่อง
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {displayState.cart.map((item, index) => (
                  <motion.div
                    key={`${item.productId}-${index}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    className="p-4 rounded-2xl bg-slate-800/50 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-mono font-black text-emerald-400 text-sm shrink-0 border border-slate-700">
                        {item.qty}×
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-white truncate">
                          {item.nameEn}
                        </div>
                        <div className="text-xs text-slate-400 truncate">
                          {item.nameTh}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          ฿{(item.unitPriceSatang / 100).toFixed(2)} each • {item.sku}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-base font-black text-white tabular-nums">
                        ฿{(item.lineTotalSatang / 100).toFixed(2)}
                      </div>
                      {item.qty > 1 && (
                        <div className="text-[10px] text-slate-400">
                          ({item.qty} × ฿{(item.unitPriceSatang / 100).toFixed(2)})
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Sticky Cart Financials Summary Footer */}
          <div className="p-6 bg-slate-900 border-t border-slate-800 shrink-0 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Subtotal (Pre-tax)</span>
                <span className="text-slate-200">
                  ฿{(displayState.financials.subtotalSatang / 100).toFixed(2)}
                </span>
              </div>

              {displayState.financials.discountSatang > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    <span>Discounts &amp; Loyalty Applied</span>
                  </span>
                  <span>-฿{(displayState.financials.discountSatang / 100).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400">
                <span>VAT 7% (Included in Total)</span>
                <span>฿{(displayState.financials.vatSatang / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Prominent Final Grand Total Due */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  Amount Payable
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  Thai Baht (THB)
                </span>
              </div>
              <div className="text-4xl font-black font-mono text-emerald-400 tracking-tight tabular-nums">
                ฿{(displayState.financials.totalSatang / 100).toLocaleString('th-TH', {
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: PROMOTIONS, QR PAYMENT & LIVE CAMPAIGNS (5 of 12 cols)     */}
        {/* ========================================================================= */}
        <section className="lg:col-span-5 flex flex-col bg-slate-950 overflow-hidden relative">
          {/* Top Half: Promotional Media Slideshow */}
          <div className="h-64 sm:h-72 p-6 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-slate-900/90 to-slate-950 border-b border-slate-800">
            {/* Promo Product Image Asset */}
            {currentPromo?.imageUrl && (
              <img
                src={currentPromo.imageUrl}
                alt={currentPromo.title}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-[0.5px] scale-105 transition-all duration-1000 pointer-events-none"
              />
            )}

            {/* Dark & Brand Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/40 pointer-events-none" />

            {/* Ambient Background Glow */}
            <div
              className="absolute inset-0 opacity-20 filter blur-3xl transition-all duration-1000 pointer-events-none"
              style={{ backgroundColor: currentPromo?.accentColor || '#10b981' }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white backdrop-blur-md border border-white/20">
                {currentPromo?.tag || 'STORE SPECIAL'}
              </span>

              <span
                className="px-3 py-1 rounded-full text-xs font-black uppercase font-mono shadow-lg"
                style={{
                  backgroundColor: currentPromo?.accentColor || '#10b981',
                  color: '#020617',
                }}
              >
                {currentPromo?.discountBadge}
              </span>
            </div>

            <div className="relative z-10 space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight">
                {currentPromo?.title}
              </h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-sm">
                {currentPromo?.subtitle}
              </p>
              <div className="text-[10px] text-slate-400 font-mono">
                {currentPromo?.expiryNote}
              </div>
            </div>

            {/* Slideshow Progress Bar & Dots */}
            <div className="relative z-10 pt-2 flex items-center gap-1.5">
              {displayState.promotions.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePromoIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    activePromoIndex === idx
                      ? 'w-8 bg-emerald-400'
                      : 'w-2 bg-slate-700 hover:bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Bottom Half: Payment Channel & PromptPay QR Display */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
            {displayState.paymentMethod === 'PROMPTPAY_QR' ? (
              <div className="flex flex-col items-center justify-center space-y-4 my-auto">
                {/* Official Thai PromptPay QR Header Banner */}
                <div className="w-full max-w-xs bg-[#003B64] text-white py-2 px-4 rounded-t-2xl text-center shadow-md flex items-center justify-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-white flex items-center justify-center text-[#003B64] font-black text-[10px]">
                    PP
                  </div>
                  <span className="text-xs font-black uppercase tracking-wider">
                    พร้อมเพย์ PromptPay QR
                  </span>
                </div>

                {/* EMVCo QR Code Graphic Matrix Frame */}
                <div className="p-4 bg-white rounded-b-2xl shadow-2xl flex flex-col items-center space-y-3 w-full max-w-xs border border-slate-200">
                  {/* Dynamic SVG Mock EMVCo Standard QR */}
                  <div className="relative p-2 bg-white rounded-xl">
                    <svg
                      className="w-44 h-44 text-slate-900"
                      viewBox="0 0 100 100"
                      fill="currentColor"
                    >
                      {/* Corner Position Detection Patterns */}
                      <rect x="5" y="5" width="26" height="26" fill="black" />
                      <rect x="9" y="9" width="18" height="18" fill="white" />
                      <rect x="13" y="13" width="10" height="10" fill="black" />

                      <rect x="69" y="5" width="26" height="26" fill="black" />
                      <rect x="73" y="9" width="18" height="18" fill="white" />
                      <rect x="77" y="13" width="10" height="10" fill="black" />

                      <rect x="5" y="69" width="26" height="26" fill="black" />
                      <rect x="9" y="73" width="18" height="18" fill="white" />
                      <rect x="13" y="77" width="10" height="10" fill="black" />

                      {/* Alignment & Timing Modules */}
                      <rect x="35" y="15" width="6" height="6" fill="black" />
                      <rect x="45" y="15" width="6" height="6" fill="black" />
                      <rect x="55" y="15" width="6" height="6" fill="black" />

                      <rect x="15" y="35" width="6" height="6" fill="black" />
                      <rect x="15" y="45" width="6" height="6" fill="black" />
                      <rect x="15" y="55" width="6" height="6" fill="black" />

                      {/* Dense Mock QR Payload Matrix */}
                      <rect x="35" y="35" width="8" height="8" fill="black" />
                      <rect x="55" y="35" width="8" height="8" fill="black" />
                      <rect x="45" y="45" width="10" height="10" fill="black" />
                      <rect x="65" y="45" width="6" height="6" fill="black" />
                      <rect x="35" y="55" width="8" height="8" fill="black" />
                      <rect x="55" y="55" width="8" height="8" fill="black" />
                      <rect x="45" y="65" width="8" height="8" fill="black" />

                      <rect x="35" y="75" width="6" height="6" fill="black" />
                      <rect x="55" y="75" width="6" height="6" fill="black" />
                      <rect x="75" y="75" width="8" height="8" fill="black" />
                      <rect x="85" y="65" width="6" height="6" fill="black" />
                      <rect x="75" y="45" width="6" height="6" fill="black" />
                      <rect x="85" y="35" width="8" height="8" fill="black" />

                      {/* Center PRODX Brand Icon */}
                      <circle cx="50" cy="50" r="10" fill="#003B64" />
                      <text
                        x="50"
                        y="53"
                        fontSize="6"
                        fontWeight="bold"
                        fill="white"
                        textAnchor="middle"
                      >
                        PX
                      </text>
                    </svg>

                    {/* Scan Guide Radar Animation */}
                    <div className="absolute inset-0 border-2 border-emerald-500/40 rounded-xl pointer-events-none animate-pulse" />
                  </div>

                  <div className="text-center font-mono">
                    <div className="text-base font-black text-slate-900">
                      ฿{(displayState.financials.totalSatang / 100).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Ref: PX-QR-{displayState.terminalId}
                    </div>
                  </div>
                </div>

                {/* Instructions & Countdown */}
                <div className="text-center space-y-1.5 max-w-xs">
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium">
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Scan with any Thai Mobile Banking App</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] font-mono text-slate-400">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Valid for {formattedCountdown}</span>
                  </div>
                </div>
              </div>
            ) : displayState.paymentMethod === 'CREDIT_CARD' ? (
              <div className="flex flex-col items-center justify-center space-y-6 my-auto text-center p-6">
                <div className="w-20 h-20 rounded-3xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-pulse">
                  <CreditCard className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-black text-white">
                    Contactless NFC &amp; Chip Card
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Please tap or insert your Visa, Mastercard, JCB, or Apple Pay device on the terminal.
                  </p>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  ฿{(displayState.financials.totalSatang / 100).toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-6 my-auto text-center p-6">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Banknote className="w-10 h-10" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-lg font-black text-white">
                    Cash Payment Tender
                  </h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Please hand cash to the cashier. Your change and receipt will be issued promptly.
                  </p>
                </div>
                <div className="text-2xl font-black font-mono text-white">
                  ฿{(displayState.financials.totalSatang / 100).toFixed(2)}
                </div>
              </div>
            )}

            {/* Bottom Security / Trust Footer */}
            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>PCI-DSS &amp; EMVCo Certified</span>
              </div>
              <span className="font-mono text-[10px]">
                PRODX POS • Dual Monitor Engine
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ORDER COMPLETED OVERLAY / TICKET CONFIRMATION SCREEN                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isOrderCompleted && displayState.completedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">
                  Thank You for Your Order!
                </h3>
                <p className="text-xs text-slate-400">
                  Payment successfully processed. Please listen for your queue number.
                </p>
              </div>

              {/* Large Queue Call Ticket */}
              <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 font-mono">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Pickup Queue Number
                </div>
                <div className="text-5xl font-black text-emerald-400 tracking-wider">
                  {displayState.completedOrder.queueNumber || 'A-01'}
                </div>
                <div className="text-xs text-slate-400">
                  Order #{displayState.completedOrder.orderNumber}
                </div>
              </div>

              {/* Transaction Recap */}
              <div className="grid grid-cols-2 gap-3 text-xs font-mono text-left bg-slate-800/40 p-4 rounded-xl">
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Paid</span>
                  <span className="font-bold text-white">
                    ฿{(displayState.completedOrder.totalSatang / 100).toFixed(2)}
                  </span>
                </div>
                {typeof displayState.completedOrder.cashChangeSatang === 'number' && (
                  <div>
                    <span className="text-slate-500 block text-[10px]">Change Due</span>
                    <span className="font-bold text-emerald-400">
                      ฿{(displayState.completedOrder.cashChangeSatang / 100).toFixed(2)}
                    </span>
                  </div>
                )}
                {typeof displayState.completedOrder.pointsEarned === 'number' && (
                  <div className="col-span-2 text-purple-300 text-[11px] font-bold">
                    ★ +{displayState.completedOrder.pointsEarned} PRODX VIP Points Credited
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span>Brewed with passion at PRODX Specialty Coffee</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
export default CustomerFacingDisplay;
