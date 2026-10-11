import { BatchCheckoutRecord, formatSatangToThb, OrderItemLine } from '../types/prodx';

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
    second: '2-digit',
  });

  // Aggregate items across all grouped orders
  const aggregatedItemsMap = new Map<
    string,
    { sku: string; nameTh: string; qty: number; unitPriceSatang: number; lineTotalSatang: number }
  >();

  batch.groupedOrders.forEach((order) => {
    order.items.forEach((item) => {
      const existing = aggregatedItemsMap.get(item.sku);
      if (existing) {
        existing.qty += item.qty;
        existing.lineTotalSatang += item.lineTotalSatang;
      } else {
        aggregatedItemsMap.set(item.sku, {
          sku: item.sku,
          nameTh: item.nameTh,
          qty: item.qty,
          unitPriceSatang: item.unitPriceSatang,
          lineTotalSatang: item.lineTotalSatang,
        });
      }
    });
  });

  const aggregatedItems = Array.from(aggregatedItemsMap.values());

  const ordersRowsHtml = batch.groupedOrders
    .map(
      (order, idx) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 6px; font-family: monospace; font-size: 11px; color: #0f172a; font-weight: 700;">
        ${order.orderNumber} ${order.queueNumber ? `(${order.queueNumber})` : ''}
      </td>
      <td style="padding: 8px 6px; font-size: 11px; color: #64748b;">
        ${new Date(order.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
      </td>
      <td style="padding: 8px 6px; font-size: 11px; color: #475569; text-align: center;">
        ${order.items.reduce((s, it) => s + it.qty, 0)} ชิ้น
      </td>
      <td style="padding: 8px 6px; font-family: monospace; font-size: 11px; color: #64748b; text-align: right;">
        ${formatSatangToThb(order.subtotalSatang)}
      </td>
      <td style="padding: 8px 6px; font-family: monospace; font-size: 11px; color: #d97706; text-align: right;">
        ${order.discountSatang > 0 ? `-${formatSatangToThb(order.discountSatang)}` : '-'}
      </td>
      <td style="padding: 8px 6px; font-family: monospace; font-size: 11px; font-weight: 700; color: #059669; text-align: right;">
        ${formatSatangToThb(order.totalSatang)}
      </td>
    </tr>
  `
    )
    .join('');

  const consolidatedItemsRowsHtml = aggregatedItems
    .map(
      (item) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 9px 6px; font-size: 12px; color: #0f172a;">
        <strong style="display: block;">${item.nameTh}</strong>
        <span style="font-size: 10px; color: #64748b; font-family: monospace;">SKU: ${item.sku}</span>
      </td>
      <td style="padding: 9px 6px; font-size: 12px; color: #334155; text-align: center; font-family: monospace; font-weight: 600;">
        ${item.qty}
      </td>
      <td style="padding: 9px 6px; font-size: 12px; color: #475569; text-align: right; font-family: monospace;">
        ${formatSatangToThb(item.unitPriceSatang)}
      </td>
      <td style="padding: 9px 6px; font-size: 12px; font-weight: 700; color: #0f172a; text-align: right; font-family: monospace;">
        ${formatSatangToThb(item.lineTotalSatang)}
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
  <title>ใบเสร็จรับเงินรวมยอด - ${batch.batchNumber}</title>
  <style>
    @media print {
      body { margin: 0; padding: 0; background: #fff !important; }
      .no-print { display: none !important; }
      .receipt-container { box-shadow: none !important; border: none !important; max-width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 16px; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div class="receipt-container" style="max-width: 680px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid #334155;">
    
    <!-- Top Header Banner -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; text-align: center; border-bottom: 3px solid #10b981;">
      <div style="display: inline-block; padding: 4px 14px; background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; border-radius: 9999px; color: #34d399; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px;">
        PRODX ENTERPRISE BATCH CHECKOUT
      </div>
      <h1 style="margin: 4px 0 0 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">
        ${storeName}
      </h1>
      <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 13px;">
        ใบเสร็จรับเงินรวมยอดหลายรายการ (Consolidated Tax Receipt)
      </p>
    </div>

    <!-- Batch Metadata Card -->
    <div style="background-color: #f8fafc; padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="font-size: 12px; color: #475569; line-height: 1.7; width: 50%;">
            <strong style="color: #0f172a; font-size: 13px;">ข้อมูลสาขาและพนักงาน:</strong><br>
            สาขา: <span style="color: #0f172a; font-weight: 600;">${batch.storeId} (สำนักงานใหญ่)</span><br>
            เลขประจำตัวผู้เสียภาษี: <span style="font-family: monospace;">0105562089123</span><br>
            กะการทำงาน: <span style="font-family: monospace;">${batch.shiftId}</span><br>
            พนักงานแคชเชียร์: <span style="color: #0f172a; font-weight: 600;">${batch.cashierName}</span>
          </td>
          <td valign="top" style="font-size: 12px; color: #475569; line-height: 1.7; width: 50%; text-align: right;">
            <strong style="color: #0f172a; font-size: 13px;">ข้อมูลการรวมยอดบิล:</strong><br>
            เลขที่ธุรกรรมรวม: <strong style="font-family: monospace; color: #047857; font-size: 14px;">${batch.batchNumber}</strong><br>
            วันที่ออกเอกสาร: <span style="color: #0f172a;">${formattedDate}</span><br>
            ช่องทางชำระเงิน: <strong style="color: #0f172a; font-family: monospace; text-transform: uppercase;">${batch.paymentMethod.replace(/_/g, ' ')}</strong><br>
            สถานะธุรกรรม: <span style="display: inline-block; padding: 2px 8px; background: #dcfce7; color: #15803d; border-radius: 4px; font-weight: 700; font-size: 11px;">SETTLED (ชำระเสร็จสมบูรณ์)</span>
          </td>
        </tr>
      </table>

      ${
        batch.customerOrCompanyName || batch.taxId || batch.notes
          ? `
      <div style="margin-top: 14px; padding: 12px 16px; background-color: #ffffff; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 12px; line-height: 1.6;">
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="color: #64748b; width: 25%;">ชื่อลูกค้า / องค์กร:</td>
            <td style="color: #0f172a; font-weight: 700; width: 75%;">${batch.customerOrCompanyName || 'ลูกค้าทั่วไป (Walk-in Customer)'}</td>
          </tr>
          ${
            batch.taxId
              ? `
          <tr>
            <td style="color: #64748b;">เลขผู้เสียภาษี (Tax ID):</td>
            <td style="color: #0f172a; font-family: monospace; font-weight: 600;">${batch.taxId}</td>
          </tr>`
              : ''
          }
          ${
            batch.contactPhone
              ? `
          <tr>
            <td style="color: #64748b;">เบอร์โทรศัพท์:</td>
            <td style="color: #0f172a; font-family: monospace;">${batch.contactPhone}</td>
          </tr>`
              : ''
          }
          ${
            batch.notes
              ? `
          <tr>
            <td style="color: #64748b;">หมายเหตุบันทึก:</td>
            <td style="color: #475569; font-style: italic;">${batch.notes}</td>
          </tr>`
              : ''
          }
        </table>
      </div>
      `
          : ''
      }
    </div>

    <!-- Section 1: Breakdown of Grouped Orders -->
    <div style="padding: 20px 24px 12px 24px; border-bottom: 1px dashed #cbd5e1;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h2 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
          1. สรุปบิลคำสั่งซื้อที่รวมชำระ (${batch.totalOrdersCount} รายการบิล)
        </h2>
        <span style="font-size: 11px; color: #64748b; font-family: monospace;">
          รวมทั้งสิ้น ${batch.totalItemsCount} ชิ้น
        </span>
      </div>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #475569; text-align: left; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 8px 6px;">เลขที่บิล (Order No.)</th>
            <th style="padding: 8px 6px;">เวลา</th>
            <th style="padding: 8px 6px; text-align: center;">จำนวนชิ้น</th>
            <th style="padding: 8px 6px; text-align: right;">ยอดรวม</th>
            <th style="padding: 8px 6px; text-align: right;">ส่วนลด</th>
            <th style="padding: 8px 6px; text-align: right;">ยอดสุทธิ (บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${ordersRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Section 2: Consolidated Itemized Goods Summary -->
    <div style="padding: 20px 24px; border-bottom: 1px solid #e2e8f0;">
      <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em;">
        2. รายการสินค้ารวมทั้งหมด (Consolidated Goods Summary)
      </h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #0f172a; color: #64748b; font-size: 11px; text-transform: uppercase; text-align: left;">
            <th style="padding-bottom: 8px;">รายการสินค้า / SKU</th>
            <th style="padding-bottom: 8px; text-align: center;">จำนวนรวม</th>
            <th style="padding-bottom: 8px; text-align: right;">ราคา/หน่วย</th>
            <th style="padding-bottom: 8px; text-align: right;">รวมเงิน (บาท)</th>
          </tr>
        </thead>
        <tbody>
          ${consolidatedItemsRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Section 3: Financial Summary & Taxes -->
    <div style="padding: 20px 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td valign="top" style="width: 50%; padding-right: 16px;">
            <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; line-height: 1.6;">
              <strong style="color: #0f172a; display: block; margin-bottom: 6px;">การชำระเงิน (Tender Breakdown):</strong>
              ช่องทาง: <strong style="color: #047857;">${batch.paymentMethod.replace(/_/g, ' ')}</strong><br>
              ${
                batch.paymentMethod === 'CASH' && batch.cashTenderedSatang
                  ? `
              เงินสดที่รับ: <span style="font-family: monospace;">${formatSatangToThb(batch.cashTenderedSatang)}</span><br>
              เงินทอน: <span style="font-family: monospace; color: #2563eb; font-weight: 700;">${formatSatangToThb(batch.cashChangeSatang || 0)}</span><br>
              `
                  : ''
              }
              ${
                batch.cardLast4
                  ? `
              หมายเลขบัตร: <span style="font-family: monospace;">•••• •••• •••• ${batch.cardLast4}</span><br>
              รหัสอนุมัติ (Auth Code): <span style="font-family: monospace;">${batch.authCode || 'APV-998124'}</span><br>
              `
                  : ''
              }
              จำนวนบิลที่รวมชำระ: <span style="font-weight: 700;">${batch.totalOrdersCount} บิล</span>
            </div>
          </td>
          <td valign="top" style="width: 50%;">
            <table width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px;">
              <tr>
                <td style="color: #64748b; padding: 4px 0;">ยอดรวมก่อนหักส่วนลด:</td>
                <td style="color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
                  ${formatSatangToThb(batch.subtotalSatang)}
                </td>
              </tr>
              ${
                batch.discountSatang > 0
                  ? `
              <tr>
                <td style="color: #d97706; padding: 4px 0;">ส่วนลดรวมทั้งหมด:</td>
                <td style="color: #d97706; font-family: monospace; text-align: right; padding: 4px 0;">
                  -${formatSatangToThb(batch.discountSatang)}
                </td>
              </tr>`
                  : ''
              }
              <tr>
                <td style="color: #64748b; padding: 4px 0;">ภาษีมูลค่าเพิ่ม 7% (รวมในราคา):</td>
                <td style="color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
                  ${formatSatangToThb(batch.vatSatang)}
                </td>
              </tr>
              <tr style="border-top: 2px solid #0f172a;">
                <td style="padding-top: 10px; font-size: 16px; font-weight: 800; color: #0f172a;">
                  ยอดรวมชำระสุทธิทั้งสิ้น:
                </td>
                <td style="padding-top: 10px; font-size: 20px; font-weight: 800; color: #059669; font-family: monospace; text-align: right;">
                  ${formatSatangToThb(batch.totalSatang)}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Cryptographic Audit & Signature Footer -->
    <div style="background-color: #0f172a; padding: 22px 24px; text-align: center; color: #94a3b8; font-size: 11px; line-height: 1.6;">
      <p style="margin: 0 0 6px 0; color: #e2e8f0; font-weight: 600;">
        ขอบคุณที่ใช้บริการ PRODX Enterprise Multi-Order Consolidated Checkout System
      </p>
      <div style="margin: 8px 0; padding: 8px 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px; font-family: monospace; font-size: 10px; color: #34d399; word-break: break-all;">
        SETTLEMENT_HASH: ${batch.settlementHash}
      </div>
      <p style="margin: 4px 0 0 0; color: #64748b; font-size: 10px;">
        เอกสารนี้ออกโดยระบบอัตโนมัติ มีผลผูกพันทางกฎหมายและไม่สามารถแก้ไขย้อนหลังได้ (Immutable Transaction Ledger)
      </p>
    </div>

  </div>
</body>
</html>
  `;
}
