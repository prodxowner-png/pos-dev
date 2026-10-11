import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  QrCode,
  Scan,
  X,
  CheckCircle2,
  AlertTriangle,
  Package,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Zap,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  History,
  Check,
} from 'lucide-react';
import { ProductItem, formatSatangToThb } from '../../types/prodx';
import { useToast } from '../../context/ToastContext';

interface BarcodeStockVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  onStockUpdated: () => void;
}

interface ScanHistoryEntry {
  id: string;
  product: ProductItem;
  scannedCode: string;
  timestamp: string;
  previousStock: number;
  updatedStock?: number;
}

// Audio beep synthesizer for successful barcode scan
const playScanBeep = (volume: number = 0.25) => {
  try {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtxClass) return;
    const ctx = new AudioCtxClass();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, now); // A6 bright beep

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Audio fallback
  }
};

export const BarcodeStockVerifierModal: React.FC<BarcodeStockVerifierModalProps> = ({
  isOpen,
  onClose,
  products,
  onStockUpdated,
}) => {
  const { showSuccess, showError } = useToast();

  // Camera & Video Elements Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Component States
  const [cameraState, setCameraState] = useState<'INITIALIZING' | 'ACTIVE' | 'DENIED' | 'UNAVAILABLE'>('INITIALIZING');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [scannedProduct, setScannedProduct] = useState<ProductItem | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [isUpdatingStock, setIsUpdatingStock] = useState<boolean>(false);
  const [adjustDelta, setAdjustDelta] = useState<number>(1);
  const [customDeltaInput, setCustomDeltaInput] = useState<string>('10');

  // Keyboard barcode buffer for physical USB scanners
  const keyBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Match code against product catalog (SKU, barcode, or ID)
  const findProductByCode = (code: string): ProductItem | null => {
    if (!code) return null;
    const clean = code.trim().toLowerCase();
    return (
      products.find(
        (p) =>
          p.sku.toLowerCase() === clean ||
          p.barcode.toLowerCase() === clean ||
          p.id.toLowerCase() === clean ||
          p.sku.toLowerCase().includes(clean)
      ) || null
    );
  };

  // Process detected or entered code
  const handleProcessCode = (code: string) => {
    if (!code.trim()) return;
    const matched = findProductByCode(code);

    if (!isMuted) {
      playScanBeep(0.3);
    }

    setScannedCode(code);

    if (matched) {
      setScannedProduct(matched);
      // Append to scan history
      setScanHistory((prev) => [
        {
          id: `SCAN-${Date.now()}`,
          product: matched,
          scannedCode: code,
          timestamp: new Date().toLocaleTimeString('th-TH'),
          previousStock: matched.stock,
        },
        ...prev,
      ]);
    } else {
      setScannedProduct(null);
      showError('SKU / Barcode Unrecognized', `No product found matching code: "${code}"`);
    }
  };

  // Physical USB Barcode Scanner Keyboard Listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs from input text elements
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 100) {
        keyBufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (keyBufferRef.current.length > 2) {
          handleProcessCode(keyBufferRef.current);
          keyBufferRef.current = '';
        }
      } else if (e.key.length === 1) {
        keyBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, products, isMuted]);

  // Camera Initialization Stream
  useEffect(() => {
    if (!isOpen) {
      // Stop camera stream when closed
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraState('INITIALIZING');
      return;
    }

    let isSubscribed = true;

    const startCamera = async () => {
      setCameraState('INITIALIZING');
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          if (isSubscribed) setCameraState('UNAVAILABLE');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!isSubscribed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('ACTIVE');
      } catch (err: any) {
        console.warn('[Barcode Scanner] Camera access error:', err);
        if (isSubscribed) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraState('DENIED');
          } else {
            setCameraState('UNAVAILABLE');
          }
        }
      }
    };

    startCamera();

    return () => {
      isSubscribed = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  // BarcodeDetector API Frame Polling Loop
  useEffect(() => {
    if (!isOpen || cameraState !== 'ACTIVE') return;

    let isScanning = true;
    let detector: any = null;

    if ('BarcodeDetector' in window) {
      try {
        detector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'code_128', 'code_39', 'upc_a', 'upc_e'],
        });
      } catch {
        detector = null;
      }
    }

    const scanFrame = async () => {
      if (!isScanning) return;
      if (detector && videoRef.current && videoRef.current.readyState === 4) {
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const rawValue = barcodes[0].rawValue;
            if (rawValue && rawValue !== scannedCode) {
              handleProcessCode(rawValue);
            }
          }
        } catch {
          // Ignore frame decode errors
        }
      }
      if (isScanning) {
        requestAnimationFrame(scanFrame);
      }
    };

    const animId = requestAnimationFrame(scanFrame);

    return () => {
      isScanning = false;
      cancelAnimationFrame(animId);
    };
  }, [isOpen, cameraState, scannedCode]);

  // Stock Adjustment Handler
  const handleAdjustStock = async (deltaQty: number) => {
    if (!scannedProduct) return;
    setIsUpdatingStock(true);

    try {
      const res = await fetch('/api/inventory/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: scannedProduct.id,
          deltaQty,
          reasonCode: deltaQty > 0 ? 'BARCODE_SCANNER_RESTOCK' : 'BARCODE_SCANNER_DEDUCT',
          actorName: 'Barcode Scanner Operator',
        }),
      });

      if (res.ok) {
        showSuccess(
          'Stock Adjusted via Scanner',
          `${deltaQty > 0 ? '+' : ''}${deltaQty} units applied to ${scannedProduct.nameEn}.`
        );

        // Update local scanned product state
        const nextStock = Math.max(0, scannedProduct.stock + deltaQty);
        setScannedProduct((prev) => (prev ? { ...prev, stock: nextStock } : null));

        // Update history entry
        setScanHistory((prev) =>
          prev.map((entry) =>
            entry.product.id === scannedProduct.id ? { ...entry, updatedStock: nextStock } : entry
          )
        );

        onStockUpdated();
      } else {
        const err = await res.json();
        showError('Stock Adjustment Failed', err.error || 'Could not adjust inventory');
      }
    } catch (err: any) {
      showError('Network Error', err?.message || 'Failed to update stock');
    } finally {
      setIsUpdatingStock(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl text-white w-full max-w-4xl overflow-hidden relative"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <Scan className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                  Real-Time Camera Scanner
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Catalog Size: {products.length} SKUs
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>สแกน QR / บาร์โค้ด ตรวจสอบสต็อกสินค้า (Live Barcode Stock Verifier)</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                isMuted
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              }`}
              title={isMuted ? 'เปิดเสียง Beep' : 'ปิดเสียง Beep'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Close Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Layout (Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Left Column: Camera Viewfinder & Manual Input (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Camera Viewfinder Box */}
            <div className="relative bg-slate-950 rounded-3xl border-2 border-slate-800 overflow-hidden min-h-[300px] flex items-center justify-center shadow-inner group">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover rounded-3xl max-h-[340px]"
              />

              {/* Viewfinder Target Reticle Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                <div className="relative w-64 h-48 border-2 border-emerald-500/70 rounded-3xl shadow-2xl flex items-center justify-center overflow-hidden">
                  {/* Corner Target Accents */}
                  <div className="absolute top-2 left-2 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-2 right-2 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-2 left-2 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-2 right-2 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                  {/* Animated Laser Scanning Line */}
                  <motion.div
                    animate={{ y: [-80, 80, -80] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399]"
                  />

                  <span className="absolute bottom-2 text-[9px] font-mono font-bold text-emerald-400 bg-slate-900/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ALIGN BARCODE INSIDE BOX
                  </span>
                </div>
              </div>

              {/* Camera State Banners */}
              {cameraState === 'INITIALIZING' && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                  <span className="text-xs font-mono font-bold">Connecting Camera Video Stream...</span>
                </div>
              )}

              {cameraState === 'DENIED' && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-2 p-6 text-center text-rose-400">
                  <AlertTriangle className="w-8 h-8" />
                  <div className="font-bold text-sm">Camera Permission Denied</div>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Please allow browser camera permissions or use the quick sample chips & manual text scanner below.
                  </p>
                </div>
              )}

              {cameraState === 'UNAVAILABLE' && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-400">
                  <Camera className="w-8 h-8 text-slate-500" />
                  <div className="font-bold text-sm text-slate-300">Live Camera Not Connected</div>
                  <p className="text-xs text-slate-400 max-w-xs">
                    No camera device detected. Use USB Barcode Reader or select a sample item below.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Sample Barcode Selector Chips for Testing */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  <span>คลิกจำลองสแกนบาร์โค้ดตัวอย่าง (Sample Scan Chips):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Instant Test</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {products.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProcessCode(p.sku)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <span>{p.sku}</span>
                    <span className="text-slate-400 font-sans font-normal text-[10px]">({p.nameTh.slice(0, 10)})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual SKU / Barcode Input Form */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 space-y-3">
              <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>กรอก SKU หรือ รหัสบาร์โค้ดด้วยตนเอง (Manual Code Entry / USB Reader):</span>
                <span className="text-[10px] text-slate-400 font-mono">Press Enter to Scan</span>
              </label>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessCode(manualCodeInput);
                  setManualCodeInput('');
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder="ใส่รหัส SKU เช่น PX-CF-001 หรือสแกนผ่านหัวอ่าน USB..."
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <Scan className="w-4 h-4" />
                  <span>ตรวจสอบ</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Scanned Product Verification Card & Restock Actions (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {scannedProduct ? (
              <motion.div
                key={scannedProduct.id}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-slate-950 border-2 border-emerald-500/60 rounded-3xl p-5 shadow-2xl space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500" />

                {/* Status Badge */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                    VERIFIED MATCH
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                      scannedProduct.stock <= scannedProduct.lowStockThreshold
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    {scannedProduct.stock <= scannedProduct.lowStockThreshold ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        <span>CRITICAL LOW STOCK</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>HEALTHY STOCK</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Product Name & SKU */}
                <div className="space-y-1">
                  <div className="text-lg font-black text-white">{scannedProduct.nameTh}</div>
                  <div className="text-xs text-slate-400 font-medium">{scannedProduct.nameEn}</div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 pt-1">
                    <span className="bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 font-bold">
                      SKU: {scannedProduct.sku}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span>Category: {scannedProduct.category}</span>
                  </div>
                </div>

                {/* Current Stock Metrics */}
                <div className="grid grid-cols-2 gap-3 bg-slate-900/90 p-3 rounded-2xl border border-slate-800 font-mono">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">คงเหลือในสต็อก</div>
                    <div className="text-2xl font-black text-white tabular-nums">
                      {scannedProduct.stock} <span className="text-xs font-normal text-slate-400">ชิ้น</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-slate-400 uppercase">ราคาขาย / ต้นทุน</div>
                    <div className="text-sm font-bold text-emerald-400 tabular-nums">
                      ฿{(scannedProduct.priceSatang / 100).toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Cost: ฿{(scannedProduct.costSatang / 100).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Fast Adjust Stock Controls */}
                <div className="space-y-2 pt-1 border-t border-slate-800">
                  <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                    <span>ปรับเพิ่ม/ลดสต็อกด่วน (Quick Adjustment):</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(1)}
                      disabled={isUpdatingStock}
                      className="py-2.5 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+1 ชิ้น</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdjustStock(5)}
                      disabled={isUpdatingStock}
                      className="py-2.5 px-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 hover:text-indigo-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+5 ชิ้น</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAdjustStock(-1)}
                      disabled={isUpdatingStock || scannedProduct.stock <= 0}
                      className="py-2.5 px-3 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 disabled:opacity-40"
                    >
                      <Minus className="w-3.5 h-3.5" />
                      <span>-1 ชิ้น</span>
                    </button>
                  </div>

                  {/* Custom Delta Restock */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="number"
                      value={customDeltaInput}
                      onChange={(e) => setCustomDeltaInput(e.target.value)}
                      className="w-20 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl font-mono text-xs font-bold text-white text-center"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(parseInt(customDeltaInput) || 10)}
                      disabled={isUpdatingStock}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5 text-amber-300" />
                      <span>เติมสต็อก +{customDeltaInput} ชิ้น</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setScannedProduct(null)}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Scan className="w-3.5 h-3.5" />
                  <span>สแกนสินค้าชิ้นถัดไป (Scan Next Item)</span>
                </button>
              </motion.div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-8 text-center space-y-3 min-h-[300px] flex flex-col items-center justify-center text-slate-500">
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-slate-400">
                  <QrCode className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm text-slate-300">พร้อมสแกนบาร์โค้ดสินค้า</div>
                <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  นำบาร์โค้ดหรือ QR Code หน้ากล่องสินค้ามาสแกนผ่านกล้อง หรือคลิกปุ่มตัวอย่างด่วนด้านซ้าย
                </p>
              </div>
            )}

            {/* Session Scan History List */}
            {scanHistory.length > 0 && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-400 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ประวัติการสแกนในรอบนี้ ({scanHistory.length})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setScanHistory([])}
                    className="text-[10px] text-slate-500 hover:text-slate-300"
                  >
                    ล้าง
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 text-xs font-mono">
                  {scanHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setScannedProduct(item.product)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800/80 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-200 text-xs">{item.product.nameTh}</div>
                        <div className="text-[10px] text-slate-400">{item.scannedCode} · {item.timestamp}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">{item.updatedStock ?? item.previousStock} units</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
