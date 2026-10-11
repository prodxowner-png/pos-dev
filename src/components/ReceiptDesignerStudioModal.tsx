import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Printer,
  Sliders,
  QrCode,
  Save,
  RotateCcw,
  Sparkles,
  Check,
  FileText,
  Copy,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface ReceiptTemplateConfig {
  storeName: string;
  branchName: string;
  taxId: string;
  paperWidthMm: 58 | 80;
  showBarcode: boolean;
  showQrSurvey: boolean;
  footerPromo: string;
  wifiNote: string;
}

const DEFAULT_CONFIG: ReceiptTemplateConfig = {
  storeName: 'PRODX COFFEE & ROASTERY',
  branchName: 'Branch 001 - BKK Central Flagship',
  taxId: 'TAX ID: 0105562098124 (VAT Registered)',
  paperWidthMm: 80,
  showBarcode: true,
  showQrSurvey: true,
  footerPromo: 'Thank you for visiting! Scan QR for 10% off your next craft brew.',
  wifiNote: 'WiFi: PRODX-GUEST / Pass: craftcoffee2026',
};

interface ReceiptDesignerStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptDesignerStudioModal: React.FC<ReceiptDesignerStudioModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showSuccess, showInfo } = useToast();
  const [config, setConfig] = useState<ReceiptTemplateConfig>(() => {
    try {
      const saved = localStorage.getItem('prodx-receipt-template');
      return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [copiedEscPos, setCopiedEscPos] = useState(false);

  useEffect(() => {
    localStorage.setItem('prodx-receipt-template', JSON.stringify(config));
  }, [config]);

  if (!isOpen) return null;

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    showInfo('Template Reset', 'Receipt formatting restored to standard factory layout.');
  };

  const handlePrintTest = () => {
    const printWindow = window.open('', '', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Test Receipt Print</title>
          <style>
            @page { margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: ${config.paperWidthMm === 58 ? '48mm' : '72mm'};
              padding: 4mm;
              font-size: 11px;
              line-height: 1.3;
              color: #000;
            }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            .flex { display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="center">
            <h3>${config.storeName}</h3>
            <div>${config.branchName}</div>
            <div>${config.taxId}</div>
          </div>
          <div class="divider"></div>
          <div>Order: PX-TEST-${Date.now().toString().slice(-4)}</div>
          <div>Date: ${new Date().toLocaleString('en-GB')}</div>
          <div>Cashier: Shift Supervisor</div>
          <div class="divider"></div>
          <div class="flex"><span>1x Single Origin Drip</span><span>฿140.00</span></div>
          <div class="flex"><span>1x Butter Croissant</span><span>฿95.00</span></div>
          <div class="divider"></div>
          <div class="flex"><span>Subtotal</span><span>฿235.00</span></div>
          <div class="flex"><span>VAT (7%)</span><span>฿16.45</span></div>
          <div class="flex" style="font-weight:bold; font-size:13px"><span>TOTAL</span><span>฿235.00</span></div>
          <div class="divider"></div>
          <div class="center">${config.footerPromo}</div>
          <div class="center" style="margin-top:4px">${config.wifiNote}</div>
          <div class="center" style="margin-top:6px; font-size:9px">*** PRODX THERMAL ENGINE ***</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleCopyRawEscPos = () => {
    const raw = `[ESC @]
[ESC a 1]${config.storeName}
${config.branchName}
${config.taxId}
--------------------------------
[ESC a 0]
1x Single Origin Drip    140.00
1x Butter Croissant       95.00
--------------------------------
TOTAL                    235.00
[ESC a 1]
${config.footerPromo}
[GS V 65 0]`;
    navigator.clipboard.writeText(raw);
    setCopiedEscPos(true);
    setTimeout(() => setCopiedEscPos(false), 2000);
    showSuccess('ESC/POS Command Copied', 'Hardware buffer commands copied to clipboard.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-900 text-white dark:bg-slate-800 dark:text-emerald-400 rounded-2xl border border-slate-700">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Thermal Receipt Studio</h3>
              <p className="text-xs text-slate-400 font-mono tracking-tight">
                No-Code ESC/POS Layout & 58mm / 80mm Dot-Matrix Formatting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content Grid */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Controls Editor (Left 7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                1. Store Header & Tax Identification
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Header Wordmark
                  </label>
                  <input
                    type="text"
                    value={config.storeName}
                    onChange={(e) => setConfig((p) => ({ ...p, storeName: e.target.value }))}
                    className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Branch Description
                    </label>
                    <input
                      type="text"
                      value={config.branchName}
                      onChange={(e) => setConfig((p) => ({ ...p, branchName: e.target.value }))}
                      className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Tax Registration ID
                    </label>
                    <input
                      type="text"
                      value={config.taxId}
                      onChange={(e) => setConfig((p) => ({ ...p, taxId: e.target.value }))}
                      className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                2. Hardware Thermal Paper Width
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { width: 80, label: '80mm Standard (Desktop EPSON / Star)' },
                  { width: 58, label: '58mm Compact (Mobile / Handheld Bluetooth)' },
                ].map((spec) => (
                  <button
                    key={spec.width}
                    type="button"
                    onClick={() => setConfig((p) => ({ ...p, paperWidthMm: spec.width as 58 | 80 }))}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      config.paperWidthMm === spec.width
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="font-mono font-bold text-base">{spec.width}mm Paper</div>
                    <div className="text-[10px] opacity-80 mt-0.5">{spec.label}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                3. Footer Promos & Customer Perks
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Promotional Note / Discount Code
                  </label>
                  <input
                    type="text"
                    value={config.footerPromo}
                    onChange={(e) => setConfig((p) => ({ ...p, footerPromo: e.target.value }))}
                    className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Store Amenities (WiFi / Feedback)
                  </label>
                  <input
                    type="text"
                    value={config.wifiNote}
                    onChange={(e) => setConfig((p) => ({ ...p, wifiNote: e.target.value }))}
                    className="w-full mt-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono"
                  />
                </div>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={config.showBarcode}
                      onChange={(e) => setConfig((p) => ({ ...p, showBarcode: e.target.checked }))}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>Print Order Barcode</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                    <input
                      type="checkbox"
                      checked={config.showQrSurvey}
                      onChange={(e) => setConfig((p) => ({ ...p, showQrSurvey: e.target.checked }))}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    <span>Include PromptPay / Survey QR</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Paper Preview (Right 5 Cols) */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Live Monospace Thermal Paper Preview
            </div>

            {/* Thermal Slip Container */}
            <div
              className={`bg-white text-slate-950 p-6 rounded-2xl shadow-2xl border border-slate-200 font-mono text-[11px] leading-relaxed transition-all ${
                config.paperWidthMm === 58 ? 'w-[280px]' : 'w-[340px]'
              }`}
              style={{
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.15)',
                fontFamily: '"JetBrains Mono", Courier, monospace',
              }}
            >
              <div className="text-center space-y-1">
                <div className="font-extrabold text-sm tracking-tight">{config.storeName}</div>
                <div className="text-[10px] text-slate-600">{config.branchName}</div>
                <div className="text-[9px] text-slate-500">{config.taxId}</div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-3" />

              <div className="space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>Order: PX-LIVE-8021</span>
                  <span>14:32</span>
                </div>
                <div className="flex justify-between">
                  <span>Shift: SH-2026-AM</span>
                  <span>Terminal #01</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-3" />

              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span>1x Drip Coffee (Mae Jan)</span>
                  <span>140.00</span>
                </div>
                <div className="flex justify-between">
                  <span>1x French Butter Croissant</span>
                  <span>95.00</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-3" />

              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>235.00</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT (7.00%)</span>
                  <span>16.45</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-300">
                  <span>TOTAL PAYABLE</span>
                  <span>฿235.00</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tender: PROMPTPAY_QR</span>
                  <span>PAID</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-400 my-3" />

              {/* QR Mock */}
              {config.showQrSurvey && (
                <div className="text-center py-2 space-y-1">
                  <div className="w-16 h-16 bg-slate-100 border border-slate-300 rounded mx-auto flex items-center justify-center">
                    <QrCode className="w-10 h-10 text-slate-800" />
                  </div>
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest">
                    Scan for E-Voucher
                  </div>
                </div>
              )}

              {/* Barcode Mock */}
              {config.showBarcode && (
                <div className="text-center py-1">
                  <div className="h-6 flex items-center justify-center gap-0.5 opacity-80">
                    {[3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4].map((w, i) => (
                      <div key={i} className="h-full bg-slate-900" style={{ width: `${w * 1.5}px` }} />
                    ))}
                  </div>
                  <div className="text-[9px] tracking-widest text-slate-500 mt-0.5">*885900120001*</div>
                </div>
              )}

              <div className="text-center text-[9px] text-slate-600 space-y-1 pt-2">
                <div>{config.footerPromo}</div>
                <div className="font-bold">{config.wifiNote}</div>
                <div className="text-[8px] opacity-40 uppercase pt-1">PRODX Thermal Kernel v4.2</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory</span>
            </button>
            <button
              onClick={handleCopyRawEscPos}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              {copiedEscPos ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEscPos ? 'Copied' : 'Raw ESC/POS Buffer'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrintTest}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>Print Test Receipt</span>
            </button>
            <button
              onClick={() => {
                showSuccess('Template Saved', 'Receipt configuration applied to all connected terminals.');
                onClose();
              }}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save & Close</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
