import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Banknote,
  QrCode,
  RotateCcw,
  Languages,
  Zap,
  HelpCircle,
  Play,
} from 'lucide-react';
import { ProductItem } from '../types/prodx';

interface PosVoiceCommandBarProps {
  products: ProductItem[];
  cartCount: number;
  onAddToCart: (product: ProductItem, quantity?: number) => void;
  onFinalizeOrder: () => void;
  onSetPaymentMethod?: (method: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD') => void;
  onClearCart?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

// Thai word numbers mapping
const THAI_NUMBER_WORDS: Record<string, number> = {
  หนึ่ง: 1,
  สอง: 2,
  สาม: 3,
  สี่: 4,
  ห้า: 5,
  หก: 6,
  เจ็ด: 7,
  แปด: 8,
  เก้า: 9,
  สิบ: 10,
  สิบเอ็ด: 11,
  สิบสอง: 12,
  โหล: 12,
  ยี่สิบ: 20,
};

// English word numbers mapping
const EN_NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  dozen: 12,
};

export const PosVoiceCommandBar: React.FC<PosVoiceCommandBarProps> = ({
  products,
  cartCount,
  onAddToCart,
  onFinalizeOrder,
  onSetPaymentMethod,
  onClearCart,
  isOpen,
  onClose,
}) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [lang, setLang] = useState<'th-TH' | 'en-US'>('th-TH');
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [lastActionFeedback, setLastActionFeedback] = useState<{
    type: 'SUCCESS' | 'ERROR' | 'INFO';
    text: string;
    subtext?: string;
  } | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean>(true);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);

  // Audio feedback using SpeechSynthesis
  const speakFeedback = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === 'undefined' || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('TTS playback error:', err);
      }
    },
    [ttsEnabled, lang]
  );

  // Extract quantity from spoken text
  const extractQuantity = (text: string): number => {
    // 1. Look for arabic numbers e.g. "2", "3"
    const digitMatch = text.match(/\b\d+\b/);
    if (digitMatch) {
      const parsed = parseInt(digitMatch[0], 10);
      if (parsed > 0 && parsed <= 99) return parsed;
    }

    // 2. Look for Thai word numbers
    for (const [word, val] of Object.entries(THAI_NUMBER_WORDS)) {
      if (text.includes(word)) return val;
    }

    // 3. Look for English word numbers
    const lower = text.toLowerCase();
    for (const [word, val] of Object.entries(EN_NUMBER_WORDS)) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) return val;
    }

    return 1;
  };

  // Find matching product in catalog
  const matchProduct = (input: string): ProductItem | null => {
    const clean = input
      .toLowerCase()
      .replace(/(เพิ่ม|เอา|สั่ง|แก้ว|ขวด|ชิ้น|อัน|กล่อง|แพ็ค|ครับ|ค่ะ|add|please|give|me|order|x\d+)/g, ' ')
      .trim();

    if (!clean) return null;

    let bestMatch: ProductItem | null = null;
    let highestScore = 0;

    for (const p of products) {
      let score = 0;
      const pNameTh = p.nameTh.toLowerCase();
      const pNameEn = p.nameEn.toLowerCase();
      const pCategory = p.category.toLowerCase();
      const pSku = p.sku.toLowerCase();

      // Exact substring match
      if (clean.includes(pNameTh) || pNameTh.includes(clean)) score += 10;
      if (clean.includes(pNameEn) || pNameEn.includes(clean)) score += 10;
      if (clean.includes(pSku)) score += 15;

      // Keywords match
      const keywords: Record<string, string[]> = {
        'prod-01': ['เอสเพรสโซ่', 'เอสเพรสโซ', 'ดับเบิ้ลช็อต', 'espresso'],
        'prod-02': ['คาราเมล', 'มัคคิอาโต้', 'คาราเมลมัคคิอาโต้', 'caramel', 'macchiato'],
        'prod-03': ['ดริป', 'กาแฟดริป', 'แม่จันใต้', 'เชียงราย', 'drip', 'pour over'],
        'prod-04': ['มัทฉะ', 'ชาเขียว', 'มัทฉะลาเต้', 'อูจิ', 'matcha', 'green tea'],
        'prod-05': ['ยูซุ', 'โคลด์บรูว์', 'สปาร์คกลิ้ง', 'โทนิค', 'yuzu', 'cold brew'],
        'prod-06': ['ครัวซองต์', 'เนยสด', 'ขนมปัง', 'croissant'],
        'prod-07': ['ทาร์ต', 'เลมอน', 'ทาร์ตเลมอน', 'เมอแรงก์', 'tart', 'lemon'],
        'prod-08': ['เมล็ดกาแฟ', 'เฮาส์เบลนด์', 'ถุง', 'house blend', 'whole bean', 'beans'],
      };

      const productKeywords = keywords[p.id] || [];
      for (const kw of productKeywords) {
        if (clean.includes(kw)) {
          score += 6;
        }
      }

      // Generic Category match
      if (clean.includes('กาแฟ') || clean.includes('coffee')) {
        if (p.category === 'COFFEE') score += 2;
      }
      if (clean.includes('เบเกอรี่') || clean.includes('ขนม') || clean.includes('bakery')) {
        if (p.category === 'BAKERY') score += 2;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = p;
      }
    }

    return highestScore >= 3 ? bestMatch : null;
  };

  // Main Command Parsing & Execution Engine
  const executeVoiceCommand = (spokenText: string) => {
    const raw = spokenText.trim();
    if (!raw) return;

    setTranscript(raw);
    const lower = raw.toLowerCase();

    // 1. FINALIZE / CHECKOUT Intent
    const isFinalizeIntent =
      lower.includes('คิดเงิน') ||
      lower.includes('ชำระเงิน') ||
      lower.includes('เช็คเอาท์') ||
      lower.includes('จ่ายตังค์') ||
      lower.includes('จบการขาย') ||
      lower.includes('ยืนยันออเดอร์') ||
      lower.includes('checkout') ||
      lower.includes('finalize') ||
      lower.includes('complete order') ||
      lower.includes('pay now');

    if (isFinalizeIntent) {
      if (cartCount === 0) {
        const msg = lang === 'th-TH' ? 'ตะกร้ายังว่างอยู่ กรุณาเพิ่มสินค้าก่อนชำระเงิน' : 'Cart is empty. Add items first.';
        setLastActionFeedback({ type: 'ERROR', text: msg });
        speakFeedback(msg);
      } else {
        const msg = lang === 'th-TH' ? 'ยืนยันการชำระเงินเรียบร้อย กำลังบันทึกคำสั่งซื้อ' : 'Finalizing order and processing checkout.';
        setLastActionFeedback({
          type: 'SUCCESS',
          text: 'ดำเนินการชำระเงิน (Order Finalized)',
          subtext: `ประมวลผลคำสั่งซื้อ ${cartCount} รายการเรียบร้อย`,
        });
        speakFeedback(msg);
        onFinalizeOrder();
      }
      return;
    }

    // 2. SET PAYMENT METHOD Intent
    if (onSetPaymentMethod) {
      if (lower.includes('เงินสด') || lower.includes('จ่ายเงินสด') || lower.includes('cash')) {
        onSetPaymentMethod('CASH');
        const msg = lang === 'th-TH' ? 'เปลี่ยนวิธีชำระเงินเป็น เงินสด' : 'Switched payment to Cash';
        setLastActionFeedback({ type: 'SUCCESS', text: msg });
        speakFeedback(msg);
        return;
      }
      if (
        lower.includes('พร้อมเพย์') ||
        lower.includes('สแกน') ||
        lower.includes('คิวอาร์') ||
        lower.includes('promptpay') ||
        lower.includes('qr')
      ) {
        onSetPaymentMethod('PROMPTPAY_QR');
        const msg = lang === 'th-TH' ? 'เปลี่ยนวิธีชำระเงินเป็น สแกน PromptPay QR' : 'Switched payment to PromptPay QR';
        setLastActionFeedback({ type: 'SUCCESS', text: msg });
        speakFeedback(msg);
        return;
      }
      if (lower.includes('บัตรเครดิต') || lower.includes('รูดบัตร') || lower.includes('credit card') || lower.includes('card')) {
        onSetPaymentMethod('CREDIT_CARD');
        const msg = lang === 'th-TH' ? 'เปลี่ยนวิธีชำระเงินเป็น บัตรเครดิต' : 'Switched payment to Credit Card';
        setLastActionFeedback({ type: 'SUCCESS', text: msg });
        speakFeedback(msg);
        return;
      }
    }

    // 3. CLEAR CART Intent
    if (onClearCart && (lower.includes('ล้างตะกร้า') || lower.includes('ยกเลิกรายการ') || lower.includes('clear cart') || lower.includes('empty cart'))) {
      onClearCart();
      const msg = lang === 'th-TH' ? 'ล้างรายการสินค้าในตะกร้าเรียบร้อย' : 'Cart cleared successfully';
      setLastActionFeedback({ type: 'INFO', text: msg });
      speakFeedback(msg);
      return;
    }

    // 4. ADD ITEM Intent
    const matchedProduct = matchProduct(raw);
    const quantity = extractQuantity(raw);

    if (matchedProduct) {
      if (matchedProduct.stock <= 0) {
        const msg = lang === 'th-TH' ? `ขออภัย ${matchedProduct.nameTh} สินค้าหมดสต็อก` : `Sorry, ${matchedProduct.nameEn} is out of stock.`;
        setLastActionFeedback({ type: 'ERROR', text: msg });
        speakFeedback(msg);
        return;
      }

      onAddToCart(matchedProduct, quantity);
      const actionText =
        lang === 'th-TH'
          ? `เพิ่ม ${matchedProduct.nameTh} x${quantity} รายการ`
          : `Added ${matchedProduct.nameEn} x${quantity} to cart`;

      setLastActionFeedback({
        type: 'SUCCESS',
        text: actionText,
        subtext: `฿${((matchedProduct.priceSatang * quantity) / 100).toFixed(2)} บาท`,
      });

      speakFeedback(
        lang === 'th-TH'
          ? `เพิ่ม ${matchedProduct.nameTh} ${quantity} ชิ้นแล้วค่ะ`
          : `Added ${quantity} ${matchedProduct.nameEn}`
      );
      return;
    }

    // Unrecognized Command
    const unrecMsg =
      lang === 'th-TH'
        ? `ไม่พบคำสั่งที่ตรงกัน: "${raw}" (ลองพูด: "เพิ่มลาเต้ 2 แก้ว" หรือ "ชำระเงิน")`
        : `Command not recognized: "${raw}". Try "Add 2 lattes" or "Checkout"`;

    setLastActionFeedback({
      type: 'INFO',
      text: unrecMsg,
    });
  };

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setMicPermissionDenied(false);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setInterimTranscript(interim);
        }

        if (final) {
          setInterimTranscript('');
          executeVoiceCommand(final);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicPermissionDenied(true);
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Automatically restart if user hasn't explicitly stopped while bar is open
        if (isListening) {
          try {
            recognition.start();
          } catch {
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('SpeechRecognition init error:', err);
      setSpeechApiSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [lang]);

  // Handle start/stop listening
  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      setIsListening(false);
      try {
        recognitionRef.current.stop();
      } catch {}
    } else {
      setTranscript('');
      setInterimTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    }
  };

  // Keyboard shortcut listener (Ctrl+M or Space toggle when modal focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isListening]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-3xl animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900/95 text-slate-100 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-4 sm:p-5 space-y-4">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={toggleListening}
                title={isListening ? 'คลิกเพื่อหยุดฟัง (Stop Listening)' : 'คลิกเพื่อเริ่มฟังคำสั่งเสียง (Start Listening)'}
                className={`p-3 rounded-2xl transition-all flex items-center justify-center cursor-pointer shadow-lg ${
                  isListening
                    ? 'bg-rose-500 text-white shadow-rose-500/30 ring-4 ring-rose-500/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {isListening ? (
                  <Mic className="w-5 h-5 animate-pulse" />
                ) : (
                  <MicOff className="w-5 h-5" />
                )}
              </button>
              {isListening && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                  <span>ผู้ช่วยสั่งการด้วยเสียง POS (Voice Commands)</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    isListening
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isListening ? 'กำลังฟังเสียง...' : 'สแตนด์บาย (กดไมค์เพื่อพูด)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                รองรับการสั่งเพิ่มสินค้าลงตะกร้า, เลือกวิธีชำระเงิน และสั่งคิดเงิน/เช็คเอาท์ทันที
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => {
                const nextLang = lang === 'th-TH' ? 'en-US' : 'th-TH';
                setLang(nextLang);
                if (recognitionRef.current) {
                  recognitionRef.current.lang = nextLang;
                }
              }}
              title="สลับภาษาการตรวจจับเสียง (Toggle Voice Language)"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-700"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'th-TH' ? 'ภาษาไทย' : 'English'}</span>
            </button>

            {/* TTS Mute Toggle */}
            <button
              type="button"
              onClick={() => setTtsEnabled(!ttsEnabled)}
              title={ttsEnabled ? 'ปิดเสียงพูดตอบรับ (Mute Voice Reply)' : 'เปิดเสียงพูดตอบรับ (Unmute Voice Reply)'}
              className={`p-2 rounded-xl transition-colors cursor-pointer border ${
                ttsEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border-slate-700'
                  : 'bg-slate-800/50 text-slate-500 border-slate-800'
              }`}
            >
              {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Audio Visualizer / Listening Status Banner */}
        {isListening && (
          <div className="p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Dynamic Soundwave Bars */}
              <div className="flex items-center gap-1 h-5 px-1">
                {[0.4, 0.9, 0.6, 1.0, 0.5, 0.8, 0.3].map((height, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400 rounded-full animate-pulse"
                    style={{
                      height: `${height * 100}%`,
                      animationDelay: `${i * 120}ms`,
                    }}
                  />
                ))}
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-bold text-white">กำลังรับฟัง: </span>
                <span className="italic font-mono text-emerald-400">
                  {interimTranscript || 'พูดชื่อสินค้าหรือคำสั่ง เช่น "เพิ่มลาเต้ 2 แก้ว" หรือ "ชำระเงิน"...'}
                </span>
              </div>
            </div>

            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              คีย์ลัด: Ctrl+M
            </span>
          </div>
        )}

        {/* Last Action Feedback Pill */}
        {lastActionFeedback && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs animate-in fade-in duration-150 ${
              lastActionFeedback.type === 'SUCCESS'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : lastActionFeedback.type === 'ERROR'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                : 'bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {lastActionFeedback.type === 'SUCCESS' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : lastActionFeedback.type === 'ERROR' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <div>
                <span className="font-bold">{lastActionFeedback.text}</span>
                {lastActionFeedback.subtext && (
                  <span className="ml-2 opacity-80 font-mono">({lastActionFeedback.subtext})</span>
                )}
              </div>
            </div>

            {transcript && (
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-xs">
                "{transcript}"
              </span>
            )}
          </div>
        )}

        {/* Quick Voice Simulator Test Chips (Work anywhere, even without mic permissions!) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
              <Play className="w-3 h-3 text-emerald-400" />
              <span>ทดสอบคำสั่งเสียงด่วน (Instant Command Chips):</span>
            </span>
            <span>คลิกเพื่อทดสอบทันที</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'เพิ่ม ลาเต้ x2', cmd: 'เพิ่มไอซ์คาราเมลมัคคิอาโต้ 2 แก้ว', icon: ShoppingBag },
              { label: 'เพิ่ม ครัวซองต์ x1', cmd: 'เพิ่มครัวซองต์เนยสดฝรั่งเศส 1 ชิ้น', icon: ShoppingBag },
              { label: 'เพิ่ม มัทฉะลาเต้ x2', cmd: 'เพิ่มอูจิมัทฉะลาเต้ 2 แก้ว', icon: ShoppingBag },
              { label: 'เพิ่ม เอสเพรสโซ่ x1', cmd: 'เพิ่มเอสเพรสโซ่ดับเบิ้ลช็อต 1 แก้ว', icon: ShoppingBag },
              { label: 'ชำระเงิน (Finalize)', cmd: 'ชำระเงิน', icon: CheckCircle2 },
              { label: 'จ่ายเงินสด', cmd: 'จ่ายเงินสด', icon: Banknote },
              { label: 'สแกน QR', cmd: 'สแกนพร้อมเพย์', icon: QrCode },
              { label: 'ล้างตะกร้า', cmd: 'ล้างตะกร้า', icon: RotateCcw },
            ].map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => executeVoiceCommand(chip.cmd)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-sm"
                >
                  <Icon className="w-3 h-3 text-emerald-400" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Microphone Permission Warning if blocked */}
        {micPermissionDenied && (
          <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              เบราว์เซอร์ยังไม่ได้รับอนุญาตให้ใช้ไมโครโฟน คุณยังคงสามารถคลิกที่ปุ่ม <b>"ทดสอบคำสั่งเสียงด่วน"</b> ด้านบนเพื่อสั่งการได้ทันที
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
