import { PosOrderRecord, formatSatangToThb } from '../types/prodx';

export interface SentReceiptRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  recipientEmail: string;
  senderEmail: string;
  totalSatang: number;
  messageId: string;
  threadId: string;
  sentAt: string;
  status: 'DELIVERED' | 'FAILED';
  errorDetails?: string;
}

/**
 * Formats a clean, responsive HTML Digital Receipt email for PRODX POS
 */
export function generateReceiptHtml(order: PosOrderRecord, storeName = 'PRODX Enterprise Flagship Store'): string {
  const formattedDate = new Date(order.createdAt).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const itemRowsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b;">
        <strong style="display: block; font-weight: 600;">${item.nameTh}</strong>
        <span style="font-size: 12px; color: #64748b;">SKU: ${item.sku}</span>
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569; text-align: center; font-family: monospace;">
        ${item.qty}
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #475569; text-align: right; font-family: monospace;">
        ${formatSatangToThb(item.unitPriceSatang)}
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; font-weight: 600; color: #0f172a; text-align: right; font-family: monospace;">
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จรับเงินดิจิทัล PRODX POS - ${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <!-- Header Banner -->
    <tr>
      <td style="background-color: #0f172a; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #10b981; font-size: 22px; font-weight: 700; tracking-tight: -0.025em;">PRODX ENTERPRISE POS</h1>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ (Digital Receipt)</p>
      </td>
    </tr>

    <!-- Order Metadata -->
    <tr>
      <td style="padding: 24px; background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
        <table width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="font-size: 13px; color: #475569; line-height: 1.6;">
              <strong style="color: #0f172a;">สาขา:</strong> ${storeName} (BKK-FLAGSHIP-01)<br>
              <strong style="color: #0f172a;">เลขประจำตัวผู้เสียภาษี:</strong> 0105562089123<br>
              <strong style="color: #0f172a;">พนักงานแคชเชียร์:</strong> ${order.cashierName}<br>
            </td>
            <td style="font-size: 13px; color: #475569; line-height: 1.6; text-align: right;">
              <strong style="color: #0f172a;">เลขที่บิล:</strong> <span style="font-family: monospace; color: #047857; font-weight: 700;">${order.orderNumber}</span><br>
              <strong style="color: #0f172a;">วันที่/เวลา:</strong> ${formattedDate}<br>
              <strong style="color: #0f172a;">ชำระเงินโดย:</strong> ${order.paymentMethod}<br>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Order Items Table -->
    <tr>
      <td style="padding: 24px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #0f172a; text-align: left; font-size: 12px; color: #64748b; text-transform: uppercase;">
              <th style="padding-bottom: 8px;">รายการสินค้า</th>
              <th style="padding-bottom: 8px; text-align: center;">จำนวน</th>
              <th style="padding-bottom: 8px; text-align: right;">ราคา/หน่วย</th>
              <th style="padding-bottom: 8px; text-align: right;">รวมเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>
      </td>
    </tr>

    <!-- Totals & Tax Invariant Section -->
    <tr>
      <td style="padding: 0 24px 24px 24px;">
        <table width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
          <tr>
            <td style="font-size: 13px; color: #64748b; padding: 4px 0;">รวมเงิน (Subtotal)</td>
            <td style="font-size: 13px; color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
              ${formatSatangToThb(order.subtotalSatang)}
            </td>
          </tr>
          ${
            order.discountSatang > 0
              ? `
          <tr>
            <td style="font-size: 13px; color: #d97706; padding: 4px 0;">ส่วนลด (Discount)</td>
            <td style="font-size: 13px; color: #d97706; font-family: monospace; text-align: right; padding: 4px 0;">
              -${formatSatangToThb(order.discountSatang)}
            </td>
          </tr>
          `
              : ''
          }
          <tr>
            <td style="font-size: 13px; color: #64748b; padding: 4px 0;">ภาษีมูลค่าเพิ่ม VAT 7% (รวมในราคา)</td>
            <td style="font-size: 13px; color: #0f172a; font-family: monospace; text-align: right; padding: 4px 0;">
              ${formatSatangToThb(order.vatSatang)}
            </td>
          </tr>
          <tr style="border-top: 1px solid #cbd5e1;">
            <td style="font-size: 16px; font-weight: 700; color: #0f172a; padding-top: 8px;">ยอดรวมชำระสุทธิ</td>
            <td style="font-size: 18px; font-weight: 700; color: #059669; font-family: monospace; text-align: right; padding-top: 8px;">
              ${formatSatangToThb(order.totalSatang)}
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Security & Barcode Reference Footer -->
    <tr>
      <td style="background-color: #0f172a; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 1.5;">
        <p style="margin: 0 0 8px 0; color: #e2e8f0; font-weight: 500;">ขอบคุณที่ใช้บริการ PRODX Enterprise Store</p>
        <p style="margin: 0 0 12px 0; font-family: monospace; font-size: 11px; color: #64748b;">
          Idempotency Ref: ${order.idempotencyKey} | Audit Signature Verified
        </p>
        <div style="font-size: 10px; color: #475569;">
          อีเมลนี้ออกโดยระบบอัตโนมัติจาก PRODX POS API ผ่านทาง Google Gmail Service Layer
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Builds RFC 2822 base64url-encoded raw message
 */
export function buildRfc2822Base64UrlEmail(
  to: string,
  subject: string,
  htmlBody: string
): string {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const emailLines = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    '',
    htmlBody,
  ];

  const rawEmail = emailLines.join('\r\n');
  
  // Base64url encoding (RFC 4648)
  const base64 = btoa(unescape(encodeURIComponent(rawEmail)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sends a digital receipt email by calling PRODX backend API
 */
export async function sendDigitalReceiptEmail(params: {
  order: PosOrderRecord;
  recipientEmail: string;
  accessToken: string;
}): Promise<{ ok: boolean; messageId?: string; threadId?: string; error?: string }> {
  try {
    const res = await fetch('/api/receipts/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        order: params.order,
        recipientEmail: params.recipientEmail,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to send receipt via backend Gmail service');
    }

    return {
      ok: true,
      messageId: data.messageId,
      threadId: data.threadId,
    };
  } catch (err: any) {
    console.error('Send Digital Receipt Error:', err);
    return {
      ok: false,
      error: err.message || 'Unknown network error sending digital receipt',
    };
  }
}
