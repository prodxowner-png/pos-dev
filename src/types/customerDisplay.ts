import { ProductItem } from './prodx';

export interface DisplayCartItem {
  productId: string;
  sku: string;
  barcode?: string;
  nameEn: string;
  nameTh: string;
  category: string;
  unitPriceSatang: number;
  qty: number;
  lineTotalSatang: number;
  imageUrl?: string;
}

export interface DisplayFinancials {
  subtotalSatang: number;
  discountSatang: number;
  directDiscountSatang?: number;
  pointsDiscountSatang?: number;
  promoDiscountSatang?: number;
  vatSatang: number;
  totalSatang: number;
  pointsToEarn: number;
}

export interface DisplayCustomer {
  id?: string;
  name: string;
  phone?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  pointsBalance: number;
}

export interface DisplayPromotion {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  discountBadge: string;
  imageUrl: string;
  accentColor: string;
  expiryNote: string;
}

export interface DisplayCompletedOrder {
  orderNumber: string;
  queueNumber: string;
  totalSatang: number;
  paymentMethod: string;
  cashTenderedSatang?: number;
  cashChangeSatang?: number;
  pointsEarned?: number;
  completedAt: string;
}

export interface CustomerDisplayState {
  version: number;
  timestamp: number;
  storeName: string;
  branchName: string;
  terminalId: string;
  cashierName: string;
  status: 'IDLE' | 'RINGING' | 'PAYMENT_PENDING' | 'ORDER_COMPLETED';
  cart: DisplayCartItem[];
  financials: DisplayFinancials;
  activeCustomer?: DisplayCustomer | null;
  paymentMethod: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT';
  promptPayQrData?: {
    qrPayload: string;
    refCode: string;
    amountSatang: number;
    expiresAt: number;
  };
  completedOrder?: DisplayCompletedOrder | null;
  promotions: DisplayPromotion[];
}

// W3C Presentation API Type Declarations for Safe TypeScript Compatibility
export interface PresentationConnectionCloseEvent extends Event {
  reason: 'error' | 'closed' | 'wentaway';
  message: string;
}

export interface PresentationConnection extends EventTarget {
  id: string;
  state: 'connecting' | 'connected' | 'closed' | 'terminated';
  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void;
  close(): void;
  terminate(): void;
  onconnect: ((this: PresentationConnection, ev: Event) => any) | null;
  onclose: ((this: PresentationConnection, ev: PresentationConnectionCloseEvent) => any) | null;
  onterminate: ((this: PresentationConnection, ev: Event) => any) | null;
  onmessage: ((this: PresentationConnection, ev: MessageEvent) => any) | null;
}

export interface PresentationAvailability extends EventTarget {
  value: boolean;
  onchange: ((this: PresentationAvailability, ev: Event) => any) | null;
}

export interface PresentationRequestConstructor {
  new (urls: string | string[]): PresentationRequest;
}

export interface PresentationRequest extends EventTarget {
  start(): Promise<PresentationConnection>;
  reconnect(presentationId: string): Promise<PresentationConnection>;
  getAvailability(): Promise<PresentationAvailability>;
  onconnectionavailable: ((this: PresentationRequest, ev: Event) => any) | null;
}

export interface PresentationReceiver {
  connectionList: Promise<{
    connections: PresentationConnection[];
    onconnectionavailable: ((this: any, ev: { connection: PresentationConnection }) => any) | null;
  }>;
}

export interface Presentation {
  defaultRequest?: PresentationRequest | null;
  receiver?: PresentationReceiver | null;
}

declare global {
  interface Navigator {
    presentation?: Presentation;
  }
  interface Window {
    PresentationRequest?: PresentationRequestConstructor;
  }
}
