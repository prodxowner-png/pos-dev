# PRODX Security Specification

## Data Invariants
1. **Financial Balance**: Total Satang must always equal (Subtotal - Discount + VAT).
2. **Stock Bound**: Stock cannot be negative.
3. **Audit Immutability**: Audit logs cannot be deleted or updated once written.
4. **Identity Integrity**: Only authenticated users can commit orders, and they must record their real ID.
5. **Supervisor Required**: Refunds and Voids require a supervisor's authorization record.

## The "Dirty Dozen" Payloads (Threat Vectors)

1. **Identity Spoofing**: Attempt to create an order with `cashierName: "Admin"` while logged in as a normal staff.
2. **Financial Invariant Breach**: Order with `subtotalSatang: 1000`, `discountSatang: 0`, `vatSatang: 70`, but `totalSatang: 500`.
3. **Negative Stock Injection**: Product update with `stock: -50`.
4. **Audit History Erasure**: Attempt to `DELETE` a document from `auditLogs`.
5. **Audit Trace Mutation**: Attempt to `UPDATE` the `entryHash` of an existing `auditLogs` record.
6. **Bypassing Supervisor**: Attempt to `VOID` an order without providing `supervisorPinUsed`.
7. **Idempotency Collision**: Attempt to write an order with a duplicated `idempotencyKey`.
8. **Auth Escalation**: Normal user attempting to adjust product `priceSatang`.
9. **Junk ID Poisoning**: Create a product with a 2KB string as ID.
10. **Ghost Field Injection**: Adding `isSystemAdmin: true` to a user profile or order.
11. **Timestamp Spoofing**: Sending `createdAt: "2020-01-01"` to backdate a sale.
12. **Unauthorized PII Access**: Attempting to read `loginThrottles` data for an identity other than one's own.

## Test Runner (Logic Requirements)
- `isValidProduct(data)` checks for required fields and non-negative stock.
- `isValidOrder(data)` checks financial math and matches `cashierId`.
- `isValidAuditLog(data)` ensures `request.time` matches and `prevHash` exists.
- `isAdmin()` helper for sensitive inventory changes.
