/**
 * Payment Service Layer
 * PRODX POS - Secure PromptPay QR & Webhook Payment Management Service
 */

export type PaymentStatus = 'WAITING' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export type PaymentCheckType =
  | 'QR_GENERATED'
  | 'AUTO_POLL'
  | 'MANUAL_CHECK'
  | 'WEBHOOK_NOTIFY'
  | 'WEBHOOK_SIM'
  | 'SLIP_OCR'
  | 'SLIP_VERIFY';

export interface PaymentTransactionRecord {
  ref1: string;
  ref2?: string;
  amountThb: number;
  paymentMethod: string;
  status: PaymentStatus;
  transactionRefId?: string;
  payerName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCheckLog {
  id: string;
  ref1: string;
  ref2?: string;
  amountThb: number;
  paymentMethod: string;
  type: PaymentCheckType;
  status: PaymentStatus;
  checkNumber: number;
  transactionRefId?: string;
  timestamp: string;
  message?: string;
}

export interface QrSessionInitParams {
  ref1: string;
  ref2?: string;
  amountThb: number;
  paymentMethod?: string;
}

export interface PaymentStatusResponse {
  ok: boolean;
  ref1: string;
  status: PaymentStatus;
  transactionRefId?: string;
  payerName?: string;
  amountThb?: number;
  paymentMethod?: string;
  updatedAt?: string;
  checkedAt?: string;
  error?: string;
}

export interface PaymentConfirmParams {
  ref1: string;
  transactionRefId?: string;
  payerName?: string;
  status?: 'SUCCESS' | 'FAILED';
}

export interface PaymentWebhookPayload {
  ref1: string;
  ref2?: string;
  transactionRefId?: string;
  payerName?: string;
  amountThb?: number;
  status?: 'SUCCESS' | 'FAILED';
  event?: 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'PAYMENT_REFUNDED';
  signature?: string;
}

export interface PaymentWebhookResponse {
  ok: boolean;
  message: string;
  event: string;
  transaction: PaymentTransactionRecord;
  receivedAt: string;
  signatureVerified: boolean;
}

export interface PaymentHistoryResponse {
  ok: boolean;
  logs: PaymentCheckLog[];
  transactions: PaymentTransactionRecord[];
  count: number;
}

export interface PollingConfig {
  ref1: string;
  ref2?: string;
  amountThb: number;
  paymentMethod?: string;
  initialDelayMs?: number;
  intervalMs?: number;
  maxAttempts?: number;
  onCheck?: (res: PaymentStatusResponse, attemptCount: number) => void;
  onSuccess?: (res: PaymentStatusResponse) => void;
  onFailed?: (res: PaymentStatusResponse) => void;
  onError?: (error: Error) => void;
}

export interface PollingController {
  stop: () => void;
  isActive: () => boolean;
  checkNow: () => Promise<PaymentStatusResponse>;
  getAttemptCount: () => number;
}

type WebhookListener = (payload: PaymentWebhookResponse) => void;

class PaymentService {
  private webhookListeners: Set<WebhookListener> = new Set();

  /**
   * Initialize a QR Payment Session on backend
   */
  async initQrSession(params: QrSessionInitParams): Promise<{ ok: boolean; transaction: PaymentTransactionRecord }> {
    const res = await fetch('/api/payment/generate-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Failed to initialize QR payment session: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Check real-time payment status via API polling
   */
  async checkStatus(ref1: string): Promise<PaymentStatusResponse> {
    if (!ref1) throw new Error('MISSING_REF1');
    const res = await fetch(`/api/payment/status?ref1=${encodeURIComponent(ref1)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch payment status: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Manually confirm or reject payment status
   */
  async confirmPayment(params: PaymentConfirmParams): Promise<{ ok: boolean; transaction: PaymentTransactionRecord }> {
    const res = await fetch('/api/payment/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      throw new Error(`Failed to confirm payment: ${res.statusText}`);
    }

    return res.json();
  }

  /**
   * Retrieve complete payment transaction & check audit log history
   */
  async fetchHistory(): Promise<PaymentHistoryResponse> {
    const res = await fetch('/api/payment/history');
    if (!res.ok) {
      throw new Error(`Failed to fetch payment history: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Record an audit log entry for payment status check
   */
  async logCheck(
    logInput: Omit<PaymentCheckLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
  ): Promise<PaymentCheckLog> {
    const payload = {
      id: logInput.id || `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: logInput.timestamp || new Date().toISOString(),
      ...logInput,
    };

    const res = await fetch('/api/payment/log-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.warn('Payment logCheck server error:', res.statusText);
      return payload as PaymentCheckLog;
    }

    const data = await res.json();
    return data.log || (payload as PaymentCheckLog);
  }

  /**
   * Trigger payment webhook (simulates incoming bank gateway payment callback)
   */
  async triggerWebhook(payload: PaymentWebhookPayload): Promise<PaymentWebhookResponse> {
    const res = await fetch('/api/payment/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'PAYMENT_RECEIVED',
        signature: 'sig_kbank_hmac_sha256_mock',
        ...payload,
      }),
    });

    if (!res.ok) {
      throw new Error(`Payment webhook delivery failed: ${res.statusText}`);
    }

    const data: PaymentWebhookResponse = await res.json();
    this.notifyWebhookListeners(data);
    return data;
  }

  /**
   * Subscribe to incoming webhook events in real-time
   */
  subscribeToWebhookEvents(listener: WebhookListener): () => void {
    this.webhookListeners.add(listener);
    return () => {
      this.webhookListeners.delete(listener);
    };
  }

  private notifyWebhookListeners(payload: PaymentWebhookResponse) {
    this.webhookListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('Webhook listener error:', err);
      }
    });
  }

  /**
   * Start automated background status polling with auto-logging and full event hooks
   */
  startPolling(config: PollingConfig): PollingController {
    const {
      ref1,
      ref2,
      amountThb,
      paymentMethod = 'PROMPTPAY_QR',
      initialDelayMs = 1200,
      intervalMs = 2500,
      maxAttempts = 120, // max 5 minutes of polling
      onCheck,
      onSuccess,
      onFailed,
      onError,
    } = config;

    let active = true;
    let attemptCount = 0;
    let initialTimer: any = null;
    let intervalTimer: any = null;

    const performCheck = async (): Promise<PaymentStatusResponse> => {
      if (!active) {
        throw new Error('Polling stopped');
      }

      try {
        const res = await this.checkStatus(ref1);
        attemptCount++;

        const isSuccess = res.status === 'SUCCESS';
        const isFailed = res.status === 'FAILED';
        const currentStatus: PaymentStatus = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'WAITING';

        const txId = isSuccess ? (res.transactionRefId || `TXN-PP-${Math.floor(10000000 + Math.random() * 90000000)}`) : undefined;

        // Auto log check
        this.logCheck({
          ref1,
          ref2,
          amountThb,
          paymentMethod,
          type: 'AUTO_POLL',
          status: currentStatus,
          checkNumber: attemptCount,
          transactionRefId: txId,
          message: isSuccess
            ? 'Transaction confirmed via automatic API polling'
            : isFailed
            ? 'Transaction marked failed by bank gateway'
            : `API Poll Check #${attemptCount} - WAITING`,
        }).catch(() => {});

        if (onCheck) onCheck(res, attemptCount);

        if (isSuccess) {
          stopPolling();
          if (onSuccess) onSuccess(res);
        } else if (isFailed) {
          stopPolling();
          if (onFailed) onFailed(res);
        } else if (attemptCount >= maxAttempts) {
          stopPolling();
          if (onFailed) {
            onFailed({
              ok: false,
              ref1,
              status: 'EXPIRED',
              error: 'MAX_POLL_ATTEMPTS_EXCEEDED',
            });
          }
        }

        return res;
      } catch (err: any) {
        if (onError) onError(err);
        throw err;
      }
    };

    const stopPolling = () => {
      active = false;
      if (initialTimer) clearTimeout(initialTimer);
      if (intervalTimer) clearInterval(intervalTimer);
    };

    // Schedule initial check and interval
    initialTimer = setTimeout(() => {
      performCheck().then(() => {
        if (active) {
          intervalTimer = setInterval(performCheck, intervalMs);
        }
      });
    }, initialDelayMs);

    return {
      stop: stopPolling,
      isActive: () => active,
      checkNow: () => performCheck(),
      getAttemptCount: () => attemptCount,
    };
  }
}

export const paymentService = new PaymentService();
