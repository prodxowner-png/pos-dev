-- 0007_m2_transaction_core.sql
CREATE TABLE IF NOT EXISTS pos_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(32) UNIQUE NOT NULL,
  store_id VARCHAR(64) NOT NULL,
  shift_id VARCHAR(64) NOT NULL,
  cashier_id VARCHAR(64) NOT NULL,
  subtotal_satang BIGINT NOT NULL CHECK (subtotal_satang >= 0),
  discount_satang BIGINT NOT NULL DEFAULT 0 CHECK (discount_satang >= 0),
  vat_satang BIGINT NOT NULL CHECK (vat_satang >= 0),
  total_satang BIGINT NOT NULL CHECK (total_satang >= 0),
  payment_method VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  idempotency_key VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Financial invariant check: subtotal - discount + vat == total
ALTER TABLE pos_orders
  ADD CONSTRAINT chk_pos_orders_financial_balance
  CHECK ((subtotal_satang - discount_satang + vat_satang) = total_satang);
