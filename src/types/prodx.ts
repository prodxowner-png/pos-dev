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

export interface PosOrderRecord {
  id: string;
  orderNumber: string;
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
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  idempotencyKey: string;
  supervisorPinUsed?: string;
  reason?: string;
  createdAt: string;
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
