export interface ProductItem {
  id: string;
  sku: string;
  barcode: string;
  nameTh: string;
  nameEn: string;
  category: 'COFFEE' | 'BAKERY' | 'BEVERAGE' | 'MERCHANDISE';
  priceSatang: number;
  costSatang: number;
  stock: number;
  lowStockThreshold: number;
  taxRatePercent: number;
  imageUrl?: string;
}

export interface CartEntry {
  product: ProductItem;
  qty: number;
}

export interface OrderItemLine {
  productId: string;
  sku: string;
  nameTh: string;
  qty: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
}

export interface PaymentSplitEntry {
  id: string;
  method: 'CASH' | 'PROMPTPAY_QR' | 'CREDIT_CARD';
  amountSatang: number;
  tenderedSatang?: number;
  changeSatang?: number;
  referenceNo?: string;
  createdAt: string;
}

export interface ShiftCashDropRecord {
  id: string;
  type: 'CASH_DROP' | 'PAID_IN' | 'PAID_OUT';
  amountSatang: number;
  reason: string;
  supervisorPin: string;
  timestamp: string;
}

export interface ShiftDrawerState {
  shiftId: string;
  storeId: string;
  cashierName: string;
  openedAt: string;
  openingFloatSatang: number;
  cashSalesSatang: number;
  qrSalesSatang: number;
  cardSalesSatang: number;
  dropsSatang: number;
  paidInSatang: number;
  paidOutSatang: number;
  currentExpectedCashSatang: number;
  dropsHistory: ShiftCashDropRecord[];
}

export interface AppliedPromotion {
  id: string;
  name: string;
  code: string;
  discountSatang: number;
  description: string;
}

export interface FullTaxInvoiceRecord {
  invoiceNumber: string;
  issuedAt: string;
  customerName: string;
  taxId: string;
  branchType: 'HEAD_OFFICE' | 'BRANCH';
  branchNumber: string;
  address: string;
  preTaxSatang: number;
  vatSatang: number;
  totalSatang: number;
  posMachineId: string;
  verificationCode: string;
}

export interface PosOrderRecord {
  id: string;
  orderNumber: string;
  queueNumber?: string;
  storeId: string;
  shiftId: string;
  cashierName: string;
  items: OrderItemLine[];
  subtotalSatang: number;
  discountSatang: number;
  vatSatang: number;
  totalSatang: number;
  paymentMethod: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT';
  payments?: PaymentSplitEntry[];
  cashTenderedSatang?: number;
  cashChangeSatang?: number;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  emailReceiptStatus?: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt?: string;
  pointsEarned?: number;
  pointsRedeemed?: number;
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  kdsStatus?: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED';
  appliedPromotions?: AppliedPromotion[];
  taxInvoice?: FullTaxInvoiceRecord;
  idempotencyKey: string;
  supervisorPinUsed?: string;
  supervisorAuthMethod?: 'PIN' | 'WEBAUTHN_BIOMETRIC';
  supervisorName?: string;
  reason?: string;
  batchPaymentId?: string;
  batchNumber?: string;
  isBatchConsolidated?: boolean;
  createdAt: string;
}

export interface BatchCheckoutRecord {
  id: string;
  batchNumber: string;
  orderIds: string[];
  orderNumbers: string[];
  groupedOrders: PosOrderRecord[];
  totalOrdersCount: number;
  totalItemsCount: number;
  subtotalSatang: number;
  discountSatang: number;
  vatSatang: number;
  totalSatang: number;
  paymentMethod: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT' | 'CORPORATE_BILL';
  payments?: PaymentSplitEntry[];
  cashTenderedSatang?: number;
  cashChangeSatang?: number;
  cardLast4?: string;
  cashierName: string;
  storeId: string;
  shiftId: string;
  customerOrCompanyName?: string;
  taxId?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  authCode?: string;
  createdAt: string;
  status: 'SETTLED' | 'VOIDED';
  settlementHash: string;
}

export interface BatchPaymentCheckoutPayload {
  orderIds?: string[];
  orderNumbers: string[];
  paymentMethod: 'PROMPTPAY_QR' | 'CASH' | 'CREDIT_CARD' | 'SPLIT' | 'CORPORATE_BILL';
  cashTenderedSatang?: number;
  cashChangeSatang?: number;
  cardLast4?: string;
  customerOrCompanyName?: string;
  taxId?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
  cashierName?: string;
  splitPayments?: PaymentSplitEntry[];
}

export type BiometricSensorType = 'FINGERPRINT' | 'FACIAL_RECOGNITION' | 'TOUCH_ID' | 'FACE_ID' | 'WINDOWS_HELLO';

export interface SupervisorBiometricProfile {
  id: string;
  name: string;
  role: 'SHIFT_SUPERVISOR' | 'STORE_MANAGER';
  biometricType: BiometricSensorType;
  credentialId: string;
  publicKeyFingerprint: string;
  enrolledAt: string;
  lastUsedAt?: string;
  deviceLabel: string;
  aaguid?: string;
}

export interface BiometricAuthResult {
  verified: boolean;
  supervisorId: string;
  supervisorName: string;
  supervisorRole: 'SHIFT_SUPERVISOR' | 'STORE_MANAGER';
  method: 'WEBAUTHN_BIOMETRIC';
  sensorType: BiometricSensorType;
  credentialId: string;
  timestamp: string;
  authenticatorAttachment: 'platform' | 'cross-platform';
  clientDataJSON?: string;
  signature?: string;
}

export interface WebAuthnChallengeResponse {
  challenge: string;
  rp: {
    name: string;
    id: string;
  };
  timeout: number;
}

export interface CustomerMember {
  id: string;
  phone: string;
  name: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  pointsBalance: number;
  totalSpentSatang: number;
  joinedAt: string;
}

export interface InterStoreTransferRecord {
  id: string;
  sourceStoreId: string;
  destinationStoreId: string;
  productId: string;
  sku: string;
  productName: string;
  qty: number;
  reason: string;
  supervisorPin: string;
  timestamp: string;
  status: 'COMPLETED';
}

export interface ShelfVelocityAnalytics {
  topSellers: {
    productId: string;
    nameEn: string;
    category: string;
    unitsSold: number;
    revenueSatang: number;
    profitSatang: number;
    marginPercent: number;
  }[];
  peakHours: {
    hour: number;
    hourLabel: string;
    ordersCount: number;
    totalSalesSatang: number;
  }[];
  grossProfitSummary: {
    totalRevenueSatang: number;
    totalCostSatang: number;
    totalGrossProfitSatang: number;
    overallMarginPercent: number;
  };
}

export interface MigrationItem {
  version: string;
  milestone: string;
  filename: string;
  description: string;
  checksum: string;
  status: 'APPLIED' | 'PENDING' | 'VERIFIED';
  appliedAt: string;
  executionMs: number;
  sqlPreview: string;
}

export interface DbInvariant {
  id: string;
  code: string;
  title: string;
  rule: string;
  status: 'ENFORCED' | 'WARNING';
  lastVerifiedAt: string;
}

export interface AuditLogRecord {
  id: string;
  sequenceNo: number;
  timestamp: string;
  actorId: string;
  actorRole: 'STORE_MANAGER' | 'SHIFT_SUPERVISOR' | 'CASHIER' | 'SYSTEM_DAEMON';
  action: string;
  resourceType: 'ORDER' | 'INVENTORY' | 'MIGRATION' | 'AUTH_SECURITY' | 'CI_CD_DEPLOY';
  resourceId: string;
  details: string;
  prevHash: string;
  entryHash: string;
  ipAddress: string;
}

export interface LoginThrottleRecord {
  identity: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastAttemptAt: string;
}

export interface TelemetrySummary {
  totalRequestsHandled: number;
  totalIdempotentHits: number;
  activeStore: string;
  activeShift: string;
  shiftStartedAt?: string;
  shiftStatus?: 'ACTIVE' | 'FINALIZED_PENDING_NEW';
  shiftOrdersCount?: number;
  shiftSalesSatang?: number;
  uptimeSeconds: number;
}

export interface Latency24hSample {
  timestamp: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
  isPeakHour?: boolean;
}

export interface ShiftRecord {
  shiftId: string;
  storeId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'ACTIVE' | 'FINALIZED';
  cashierName: string;
  finalizedBy?: string;
  ordersCount: number;
  totalSalesSatang: number;
  totalVatSatang: number;
  totalDiscountSatang: number;
  handoverNotes?: string;
  openingFloatSatang?: number;
  auditLogId?: string;
  auditLogHash?: string;
}

export interface FinalizeShiftPayload {
  supervisorPin: string;
  finalizedBy?: string;
  handoverNotes?: string;
}

export interface StartNewShiftPayload {
  newShiftId: string;
  cashierName?: string;
  openingFloatSatang?: number;
  notes?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
  cpuPercent: number;
  memoryMb: number;
  dbActiveConnections: number;
  dbIdleConnections: number;
  errorRatePercent: number;
  diskUsedGb?: number;
  diskTotalGb?: number;
  dbMaxPoolSize?: number;
  memoryTotalMb?: number;
}

export interface Latency24hPoint {
  timestamp: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  rps: number;
  isPeakHour?: boolean;
}

export type CloudProviderId = 'GCP_CLOUD_RUN' | 'AWS_ECS_FARGATE' | 'AZURE_CONTAINER_APPS' | 'RAILWAY_ENTERPRISE';

export interface ServiceResourceAllocation {
  id: string;
  name: string;
  containerImage: string;
  role: 'API_FRONTEND' | 'DATABASE' | 'CACHE' | 'OBSERVABILITY';
  instances: number;
  cpuCores: number;
  memoryGb: number;
  storageGb: number;
  storageType: 'EPHEMERAL' | 'PERSISTENT_SSD';
  networkEgressGbMonthly: number;
  highAvailability: boolean;
}

export interface CloudPricingUnit {
  providerId: CloudProviderId;
  providerName: string;
  region: string;
  currencyThbRate: number; // e.g. 35.5 THB per USD
  vcpuPerHourUsd: number;
  ramGbPerHourUsd: number;
  storageSsdGbPerMonthUsd: number;
  egressGbUsd: number;
  managedPostgresBaseFeeUsd: number;
  managedRedisBaseFeeUsd: number;
  slaPercent: number;
}

export interface ServiceCostLine {
  serviceId: string;
  name: string;
  role: ServiceResourceAllocation['role'];
  computeCostUsd: number;
  ramCostUsd: number;
  storageCostUsd: number;
  egressCostUsd: number;
  totalServiceMonthlyUsd: number;
  totalServiceMonthlyThb: number;
  costSharePercent: number;
}

export interface InfraEstimateResult {
  provider: CloudPricingUnit;
  hoursPerMonth: number;
  lineItems: ServiceCostLine[];
  monthlyTotalUsd: number;
  monthlyTotalThb: number;
  annualTotalUsd: number;
  annualTotalThb: number;
  costPerTransactionSatang: number;
  projectedTransactionsMonthly: number;
  reserveDiscountAppliedPercent: number;
}

export function formatSatangToThb(satang: number): string {
  const thb = satang / 100;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(thb);
}

export interface DatabaseSnapshotSchedule {
  enabled: boolean;
  dailyTimeUtc: string; // e.g. "03:00"
  dailyTimeLocal: string; // e.g. "10:00 (UTC+7 Bangkok)"
  cronExpression: string; // e.g. "0 3 * * *"
  retentionDays: number; // e.g. 30
  s3Bucket: string; // e.g. "s3://prodx-pos-backups-bkk-prod/postgres-16/"
  s3Region: string; // e.g. "ap-southeast-1"
  storageClass: 'STANDARD' | 'STANDARD_IA' | 'GLACIER_IR';
  compressionType: 'ZSTD_HIGH' | 'GZIP_FAST' | 'PG_DUMP_CUSTOM';
  encryption: 'AWS_KMS_CMK' | 'AES_256';
  kmsKeyId: string;
  lastRunAt: string | null;
  nextRunAt: string;
}

export interface DatabaseSnapshotRecord {
  id: string;
  type: 'DAILY_SCHEDULED' | 'ON_DEMAND_S3' | 'PRE_MIGRATION_GUARD' | 'WAL_ARCHIVE';
  s3Uri: string;
  sizeBytes: number;
  compressedSizeMb: number;
  uncompressedSizeMb: number;
  compressionRatio: string;
  status: 'UPLOADED_TO_S3' | 'VERIFIED' | 'FAILED' | 'CREATING';
  sha256Checksum: string;
  durationSeconds: number;
  createdAt: string;
  verifiedAt: string;
  triggeredBy: string;
  note?: string;
}

export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type NotificationCategory =
  | 'SECURITY_BREACH'
  | 'SERVER_DOWNTIME'
  | 'AUTHORIZATION_VIOLATION'
  | 'DATABASE_LATENCY'
  | 'INVENTORY_ALERT'
  | 'SYSTEM_HEALTH';

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  createdAt: string;
  read: boolean;
  actorId?: string;
  sourceIp?: string;
  resourceId?: string;
  actionLink?: {
    module: 'POS' | 'INVENTORY' | 'CUSTOMER_DISPLAY' | 'KDS' | 'MIGRATIONS' | 'BACKEND_CONNECT' | 'DOCKER_CICD' | 'COST_ESTIMATOR' | 'TELEMETRY' | 'SECURITY';
    label: string;
  };
  resolved?: boolean;
}

export interface NotificationFeedResponse {
  notifications: SystemNotification[];
  unreadCount: number;
  criticalCount: number;
  serverStatus: {
    status: 'OPERATIONAL' | 'DEGRADED' | 'DOWNTIME';
    uptimeSeconds: number;
    lastPingAt: string;
    activeThreatsCount: number;
  };
}

export interface StockPredictionItem {
  productId: string;
  sku: string;
  nameTh: string;
  nameEn: string;
  category: 'COFFEE' | 'BAKERY' | 'BEVERAGE' | 'MERCHANDISE';
  currentStock: number;
  lowStockThreshold: number;
  costSatang: number;
  priceSatang: number;
  dailyVelocity: number; // units sold per day
  hourlyVelocity: number; // units sold per operational hour
  historicalUnitsSold: number;
  daysToStockout: number; // calculated Days-to-Stockout
  hoursToStockout: number;
  projectedStockoutDate: string; // ISO string
  daysUntilThreshold: number; // days until reaching lowStockThreshold
  reorderRecommended: boolean; // boolean flag for 'Reorder Recommended' alert
  reorderUrgency: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  reorderReason: string;
  suggestedReorderQty: number;
  totalPoCostSatang: number;
  confidenceScore: number; // 0-100%
  demandTrend: 'SURGING' | 'STEADY' | 'DECLINING';
  aiForecastNotes?: string;
}

export interface InventoryAiForecastSummary {
  generatedAt: string;
  source: 'GEMINI_AI' | 'DETERMINISTIC_VELOCITY_ENGINE';
  modelUsed: string;
  executiveSummary: string;
  totalItemsAnalyzed: number;
  itemsNeedingReorder: number;
  criticalItemsCount: number;
  recommendedPoBudgetSatang: number;
  predictions: StockPredictionItem[];
  macroInsights: string[];
}
