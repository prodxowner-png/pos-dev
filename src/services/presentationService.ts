import {
  CustomerDisplayState,
  PresentationConnection,
  PresentationRequest,
} from '../types/customerDisplay';
import { DEFAULT_PROMOTIONS } from './customerDisplayPromos';

const BROADCAST_CHANNEL_NAME = 'prodx_customer_display_sync';
const LOCAL_STORAGE_KEY = 'prodx_customer_display_latest_state';

// Initial baseline display state
export const INITIAL_CUSTOMER_DISPLAY_STATE: CustomerDisplayState = {
  version: 1,
  timestamp: Date.now(),
  storeName: 'PRODX SPECIALTY COFFEE & ARTISAN BAKERY',
  branchName: 'Bangkok Flagship (BKK-FLAGSHIP-01)',
  terminalId: 'POS-REG-01',
  cashierName: 'Somchai Prasert (Lead Cashier)',
  status: 'IDLE',
  cart: [],
  financials: {
    subtotalSatang: 0,
    discountSatang: 0,
    vatSatang: 0,
    totalSatang: 0,
    pointsToEarn: 0,
  },
  activeCustomer: null,
  paymentMethod: 'PROMPTPAY_QR',
  promotions: DEFAULT_PROMOTIONS,
};

class PresentationSyncService {
  private activeConnection: PresentationConnection | null = null;
  private presentationRequest: PresentationRequest | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private listeners: Set<(state: CustomerDisplayState) => void> = new Set();
  private connectionChangeListeners: Set<(connected: boolean) => void> = new Set();
  private isAvailable: boolean = false;
  private isInitialized: boolean = false;
  private latestState: CustomerDisplayState = INITIAL_CUSTOMER_DISPLAY_STATE;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Initialize BroadcastChannel for cross-window / secondary monitor messaging
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data && typeof event.data === 'object') {
            this.handleIncomingState(event.data as CustomerDisplayState);
          }
        };
      }
    } catch (e) {
      console.warn('[PRODX Presentation] BroadcastChannel unavailable, using storage fallback', e);
    }

    // 2. Storage event fallback for cross-window synchronization
    window.addEventListener('storage', (event: StorageEvent) => {
      if (event.key === LOCAL_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          this.handleIncomingState(parsed);
        } catch {}
      }
    });

    // 3. Load latest stored state if exists
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.latestState = JSON.parse(stored);
      }
    } catch {}

    // 4. Initialize W3C Presentation API if supported
    this.initPresentationApi();

    // 5. Initialize Presentation API Receiver if running on the secondary monitor
    this.initPresentationReceiver();
  }

  private initPresentationApi() {
    if (typeof window === 'undefined' || !window.PresentationRequest) {
      return;
    }

    try {
      const targetUrl = this.getPresentationTargetUrl();
      this.presentationRequest = new window.PresentationRequest([targetUrl]);

      this.presentationRequest
        .getAvailability()
        .then((availability) => {
          this.isAvailable = availability.value;
          availability.onchange = () => {
            this.isAvailable = availability.value;
            this.notifyConnectionChange(this.isConnected());
          };
        })
        .catch(() => {
          this.isAvailable = false;
        });
    } catch (e) {
      console.warn('[PRODX Presentation] PresentationRequest initialization notice:', e);
    }
  }

  private initPresentationReceiver() {
    if (
      typeof navigator === 'undefined' ||
      !navigator.presentation ||
      !navigator.presentation.receiver
    ) {
      return;
    }

    navigator.presentation.receiver.connectionList
      .then((list) => {
        list.connections.forEach((conn) => this.bindReceiverConnection(conn));
        list.onconnectionavailable = (event) => {
          this.bindReceiverConnection(event.connection);
        };
      })
      .catch((e) => {
        console.warn('[PRODX Presentation Receiver] ConnectionList notice:', e);
      });
  }

  private bindReceiverConnection(connection: PresentationConnection) {
    this.activeConnection = connection;
    this.notifyConnectionChange(true);

    connection.onmessage = (event: MessageEvent) => {
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        this.handleIncomingState(parsed);
      } catch (err) {
        console.error('[PRODX Receiver] Error parsing presentation message:', err);
      }
    };

    connection.onclose = () => {
      this.notifyConnectionChange(false);
    };

    connection.onterminate = () => {
      this.notifyConnectionChange(false);
    };
  }

  public getPresentationTargetUrl(): string {
    if (typeof window === 'undefined') return '/?display=customer';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?display=customer`;
  }

  private handleIncomingState(state: CustomerDisplayState) {
    this.latestState = state;
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (e) {
        console.error('[PRODX Presentation] Listener error:', e);
      }
    });
  }

  public publishState(state: CustomerDisplayState) {
    this.latestState = {
      ...state,
      timestamp: Date.now(),
      version: (this.latestState?.version || 0) + 1,
    };

    // 1. Broadcast via active Presentation API connection
    if (this.activeConnection && this.activeConnection.state === 'connected') {
      try {
        this.activeConnection.send(JSON.stringify(this.latestState));
      } catch (e) {
        console.warn('[PRODX Presentation] Failed to send via PresentationConnection:', e);
      }
    }

    // 2. Broadcast via BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(this.latestState);
      } catch (e) {
        console.warn('[PRODX Presentation] BroadcastChannel post error:', e);
      }
    }

    // 3. Fallback to localStorage
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.latestState));
    } catch {}

    // 4. Notify local in-app listeners
    this.listeners.forEach((l) => l(this.latestState));
  }

  public async startPresentation(): Promise<PresentationConnection | null> {
    if (typeof window === 'undefined') return null;

    if (window.PresentationRequest && this.presentationRequest) {
      try {
        const connection = await this.presentationRequest.start();
        this.activeConnection = connection;
        this.notifyConnectionChange(true);

        connection.onconnect = () => this.notifyConnectionChange(true);
        connection.onclose = () => {
          this.activeConnection = null;
          this.notifyConnectionChange(false);
        };
        connection.onterminate = () => {
          this.activeConnection = null;
          this.notifyConnectionChange(false);
        };

        // Immediately push current state
        connection.send(JSON.stringify(this.latestState));
        return connection;
      } catch (e: any) {
        if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
          console.warn('[PRODX Presentation] Presentation start fallback to window popup:', e);
        }
      }
    }

    // Secondary Screen Window Fallback
    return this.openSecondaryWindow();
  }

  public openSecondaryWindow(): PresentationConnection | null {
    if (typeof window === 'undefined') return null;

    const targetUrl = this.getPresentationTargetUrl();
    const width = 1280;
    const height = 800;
    // Attempt positioning on secondary screen if screen coordinates indicate multi-monitor
    const left = window.screen.availWidth || 1920;
    const top = 0;

    const popup = window.open(
      targetUrl,
      'PRODX_CUSTOMER_DISPLAY',
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
    );

    if (popup) {
      popup.focus();
      this.notifyConnectionChange(true);
      // Push state
      setTimeout(() => this.publishState(this.latestState), 500);
    }
    return null;
  }

  public isConnected(): boolean {
    return (
      (this.activeConnection !== null && this.activeConnection.state === 'connected') ||
      this.isAvailable
    );
  }

  public isPresentationApiSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.PresentationRequest !== 'undefined';
  }

  public isSecondScreenAvailable(): boolean {
    return this.isAvailable;
  }

  public subscribe(callback: (state: CustomerDisplayState) => void): () => void {
    this.listeners.add(callback);
    // Immediately provide latest known state
    callback(this.latestState);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public onConnectionChange(callback: (connected: boolean) => void): () => void {
    this.connectionChangeListeners.add(callback);
    callback(this.isConnected());
    return () => {
      this.connectionChangeListeners.delete(callback);
    };
  }

  private notifyConnectionChange(connected: boolean) {
    this.connectionChangeListeners.forEach((cb) => {
      try {
        cb(connected);
      } catch {}
    });
  }

  public getLatestState(): CustomerDisplayState {
    return this.latestState;
  }
}

export const presentationService = new PresentationSyncService();
