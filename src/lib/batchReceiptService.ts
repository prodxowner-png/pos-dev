import { BatchCheckoutRecord, formatSatangToThb } from '../types/prodx';

/**
 * Generates a high-fidelity HTML Consolidated Master Receipt for Batch Payment Transactions
 */
export function generateConsolidatedReceiptHtml(
  batch: BatchCheckoutRecord,
  storeName = 'PRODX Enterprise Flagship Store'
): string {
  const formattedDate = new Date(batch.createdAt).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Table rows for included individual orders
  const ordersSummaryRows = batch.groupedOrders
    .map((ord, idx) => {
      const itemCount = (ord.items || []).reduce((acc, it) => acc + it.qty, 0);
      const ordDate = new Date(ord.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 10px; font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace;">
          ${idx + 1}. ${ord.orderNumber} ${ord.queueNumber ? `(${ord.queueNumber})` : ''}
        </td>
        <td style="padding: 8px 10px; font-size: 12px; color: #64748b; text-align: center;">${ordDate}</td>
        <td style="padding: 8px 10px; font-size: 12px; color: #475569; text-align: center; font-family: monospace;">${itemCount} รายการ</td>
        <td style="padding: 8px 10px; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; font-family: monospace;">
          ${formatSatangToThb(ord.totalSatang)}
        </td>
      </tr>
    `;
    })
    .join('');

  // Consolidate identical items across orders
  const itemMap = new Map<string, { sku: string; nameTh: string; unitPriceSatang: number; qty: number; totalSatang: number }>();

  batch.groupedOrders.forEach((ord) => {
    (ord.items || []).forEach((item) => {
      const existing = itemMap.get(item.sku || item.productId);
      if (existing) {
        existing.qty += item.qty;
        existing.totalSatang += item.lineTotalSatang;
      } else {
        itemMap.set(item.sku || item.productId, {
          sku: item.sku,
          nameTh: item.nameTh,
          unitPriceSatang: item.unitPriceSatang,
          qty: item.qty,
          totalSatang: item.lineTotalSatang,
        });
      }
    });
  });

  const combinedItemsRows = Array.from(itemMap.values())
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 0; font-size: 13px; color: #1e293b;">
        <strong style="display: block; font-weight: 600;">${item.nameTh}</strong>
        <span style="font-size: 11px; color: #64748b; font-family: monospace;">SKU: ${item.sku}</span>
      </td>
      <td style="padding: 8px 0; font-size: 13px; color: #334155; text-align: center; font-family: monospace;">
        ${item.qty}
      </td>
      <td style="padding: 8px 0; font-size: 13px; color: #475569; text-align: right; font-family: monospace;">
        ${formatSatangToThb(item.unitPriceSatang)}
      </td>
      <td style="padding: 8px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-align: right; font-family: monospace;">
        ${formatSatangToThb(item.totalSatang)}
      </td>
    </tr>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จรับเงินรวมยอด PRODX POS - ${batch.batchNumber}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08);">
    
    <!-- Header Banner -->
    <tr>
      <td style="background-color: #0f172a; padding: 28px; text-align: center;">
        <div style="display: inline-block; padding: 4px 12px; background-color: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 9999px; color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
          CONSOLIDATED MASTER CHECKOUT
        </div>
        <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; tracking-tight: -0.025em;">PRODX ENTERPRISE POS</h1>
        <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 14px;">ใบเสร็จรับเงินรวมยอดชำระ / Consolidated Master Tax Receipt</p>
      </td>
    </tr>

    <!-- Batch Transaction Metadata -->
    <tr>
      <td style="padding: 20px 28px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size: 13px; color: #475569; line-height: 1.6;">
              <strong style="color: #0f172a;">สาขา:</strong> ${storeName} (BKK-FLAGSHIP-01)<br>
              <strong style="color: #0f172a;">เลขประจำตัวผู้เสียภาษี:</strong> 0105562089123<br>
              <strong style="color: #0f172a;">พนักงานดำเนินการ:</strong> ${batch.cashierName}<br>
              ${batch.customerOrCompanyName ? `<strong style="color: #0f172a;">ลูกค้า / องค์กร:</strong> ${batch.customerOrCompanyName}<br>` : ''}
              ${batch.taxId ? `<strong style="color: #0f172a;">เลขผู้เสียภาษีลูกค้า:</strong> ${batch.taxId}<br>` : ''}
            </td>
            <td style="font-size: 13px; color: #475569; line-height: 1.6; text-align: right; vertical-align: top;">
              <strong style="color: #0f172a;">เลขที่บิลรวม:</strong> <span style="font-family: monospace; color: #047857; font-weight: 800; font-size: 14px;">${batch.batchNumber}</span><br>
              <strong style="color: #0f172a;">วันที่/เวลา:</strong> ${formattedDate}<br>
              <strong style="color: #0f172a;">ช่องทางชำระเงิน:</strong> <span style="color: #2563eb; font-weight: 700;">${batch.paymentMethod.replace('_', ' ')}</span><br>
              <strong style="color: #0f172a;">จำนวนบิลที่รวม:</strong> <span style="font-weight: 700; color: #0f172a;">${batch.totalOrdersCount} บิล (${batch.totalItemsCount} ชิ้น)</span><br>
            </td>
          </tr>
        </table>
        ${
          batch.notes
            ? `<div style="margin-top: 12px; padding: 10px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; color: #334155;">
                <strong style="color: #0f172a;">หมายเหตุ / อ้างอิงโครงการ:</strong> ${batch.notes}
               </div>`
            : ''
        }
      </td>
    </tr>

    <!-- Table 1: Included Orders Breakdown -->
    <tr>
      <td style="padding: 24px 28px 12px 28px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; tracking-wider: 0.05em; display: flex; align-items: center; justify-content: space-between;">
          <span>1. รายการบิลที่นำมารวมชำระ (${batch.totalOrdersCount} บิล)</span>
        </h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; font-size: 12px; color: #475569; text-transform: uppercase;">
              <th style="padding: 8px 10px; text-align: left;">เลขที่ออเดอร์</th>
              <th style="padding: 8px 10px; text-align: center;">เวลา</th>
              <th style="padding: 8px 10px; text-align: center;">จำนวนสินค้า</th>
              <th style="padding: 8px 10px; text-align: right;">ยอดเงินบิล</th>
            </tr>
          </thead>
          <tbody>
            ${ordersSummaryRows}
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Table 2: Consolidated Itemized Summary -->
    <tr>
      <td style="padding: 12px 28px 24px 28px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; tracking-wider: 0.05em;">
          2. รายการสินค้าสะสมรวมทั้งหมด (${batch.totalItemsCount} ชิ้น)
        </h3>
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">
              <th style="padding-bottom: 8px;">รายการสินค้า</th>
              <th style="padding-bottom: 8px; text-align: center;">รวมจำนวน</th>
              <th style="padding-bottom: 8px; text-align: right;">ราคา/หน่วย</th>
              <th style="padding-bottom: 8px; text-align: right;">รวมเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            ${combinedItemsRows}
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Financial Totals Box -->
    <tr>
      <td style="padding: 0 28px 24px 28px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="font-size: 13px; color: #64748b; padding: 4px 0;">ยอดรวมก่อนส่วนลด (Subtotal)</td>
            <td style="font-size: 13px; color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
              ${formatSatangToThb(batch.subtotalSatang)}
            </td>
          </tr>
          ${
            batch.discountSatang > 0
              ? `
          <tr>
            <td style="font-size: 13px; color: #d97706; padding: 4px 0;">ส่วนลดรวม (Total Discounts)</td>
            <td style="font-size: 13px; color: #d97706; font-family: monospace; text-align: right; padding: 4px 0;">
              -${formatSatangToThb(batch.discountSatang)}
            </td>
          </tr>
          `
              : ''
          }
          <tr>
            <td style="font-size: 13px; color: #64748b; padding: 4px 0;">ภาษีมูลค่าเพิ่ม VAT 7% (รวมในราคา)</td>
            <td style="font-size: 13px; color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
              ${formatSatangToThb(batch.vatSatang)}
            </td>
          </tr>
          <tr style="border-top: 2px solid #cbd5e1;">
            <td style="font-size: 16px; font-weight: 800; color: #0f172a; padding-top: 10px;">ยอดชำระรวมสุทธิ (Net Total)</td>
            <td style="font-size: 20px; font-weight: 800; color: #059669; font-family: monospace; text-align: right; padding-top: 10px;">
              ${formatSatangToThb(batch.totalSatang)}
            </td>
          </tr>
          ${
            batch.paymentMethod === 'CASH' && batch.cashTenderedSatang
              ? `
          <tr style="border-top: 1px dashed #cbd5e1;">
            <td style="font-size: 12px; color: #475569; padding-top: 8px;">ชำระด้วยเงินสด (Cash Tendered)</td>
            <td style="font-size: 12px; color: #0f172a; font-family: monospace; text-align: right; padding-top: 8px;">
              ${formatSatangToThb(batch.cashTenderedSatang)}
            </td>
          </tr>
          <tr>
            <td style="font-size: 12px; color: #059669; font-weight: 700;">เงินทอน (Change)</td>
            <td style="font-size: 12px; color: #059669; font-family: monospace; font-weight: 700; text-align: right;">
              ${formatSatangToThb(batch.cashChangeSatang || 0)}
            </td>
          </tr>
          `
              : ''
          }
        </table>
      </td>
    </tr>

    <!-- Footer & Non-Repudiation Certificate -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.6;">
        <p style="margin: 0 0 6px 0; color: #10b981; font-weight: 700; font-size: 13px;">
          PRODX ENTERPRISE BATCH SETTLEMENT CERTIFIED
        </p>
        <p style="margin: 0 0 10px 0; font-family: monospace; font-size: 10px; color: #64748b; word-break: break-all;">
          SHA-256 Settlement Hash: ${batch.settlementHash}
        </p>
        <div style="font-size: 11px; color: #475569;">
          ออกโดยระบบ PRODX POS Batch Payment Engine | เอกสารชำระเงินรวมยอดถูกต้องสมบูรณ์ตามกฎหมาย
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
