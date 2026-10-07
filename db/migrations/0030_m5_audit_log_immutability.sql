-- 0030_m5_audit_log_immutability.sql
CREATE TABLE IF NOT EXISTS immutable_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_no BIGSERIAL UNIQUE NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  action VARCHAR(128) NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_id VARCHAR(128) NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash VARCHAR(64) NOT NULL,
  entry_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'PRODX_IMMUTABLE_AUDIT_VIOLATION: Audit logs are append-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON immutable_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
