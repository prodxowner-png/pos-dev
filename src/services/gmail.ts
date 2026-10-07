import { getAccessToken } from '../lib/firebaseAuth';

export interface ReceiptItemLine {
  productId?: string;
  sku?: string;
  nameTh: string;
  nameEn?: string;
  qty: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

export interface ReceiptData {
  id?: string;
  orderNumber: string;
  storeId?: string;
  shiftId?: string;
  cashierName?: string;
  items: ReceiptItemLine[];
  subtotalSatang: number;
  discountSatang?: number;
  vatSatang?: number;
  totalSatang: number;
  paymentMethod?: string;
  status?: string;
  idempotencyKey?: string;
  createdAt?: string;
}

export interface SendReceiptResult {
  ok: boolean;
  messageId?: string;
  threadId?: string;
  recipientEmail?: string;
  sentAt?: string;
  error?: string;
}

/**
 * Connects to the PRODX backend to dispatch digital receipts to customers via Google Gmail API.
 *
 * @param email Recipient email address
 * @param receiptData Detailed transaction receipt payload
 * @param customAccessToken Optional Google OAuth access token
 */
export async function sendDigitalReceipt(
  email: string,
  receiptData: ReceiptData,
  customAccessToken?: string
): Promise<SendReceiptResult> {
  const token = customAccessToken || (await getAccessToken());

  if (!token) {
    throw new Error('GMAIL_AUTH_REQUIRED: Please sign in with Google to authorize sending digital receipts via Gmail API.');
  }

  const response = await fetch('/api/receipts/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      order: receiptData,
      recipientEmail: email,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'Failed to dispatch digital receipt via PRODX backend');
  }

  return {
    ok: true,
    messageId: data.messageId,
    threadId: data.threadId,
    recipientEmail: data.recipientEmail,
    sentAt: data.sentAt,
  };
}
