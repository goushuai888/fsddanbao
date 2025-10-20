# Wallet Service Specification

## ADDED Requirements

### Requirement: Unified Wallet Service
The system SHALL provide a centralized WalletService to handle all financial operations.

#### Scenario: Credit user balance
- **WHEN** a credit operation is requested with valid parameters (userId, amount > 0, type, note)
- **THEN** the system SHALL:
  - Create a Payment record with the specified type and amount
  - Increment the user's balance by the amount
  - Execute both operations atomically in a database transaction
  - Record an audit log entry
  - Return the created Payment and new balance

#### Scenario: Debit user balance
- **WHEN** a debit operation is requested with valid parameters (userId, amount > 0, type, note)
- **THEN** the system SHALL:
  - Validate that the user's balance is sufficient (balance >= amount)
  - Create a Payment record with the specified type and amount
  - Decrement the user's balance by the amount
  - Execute both operations atomically in a database transaction
  - Record an audit log entry
  - Return the created Payment and new balance

#### Scenario: Insufficient balance
- **WHEN** a debit operation is requested but the user's balance is insufficient
- **THEN** the system SHALL:
  - Reject the operation without creating any Payment record
  - Return an error indicating "余额不足"
  - NOT modify the user's balance

#### Scenario: Transaction rollback on error
- **WHEN** any error occurs during a financial operation (e.g., database error)
- **THEN** the system SHALL:
  - Rollback the entire transaction (Payment creation AND balance update)
  - NOT leave partial data (Payment without balance update, or vice versa)
  - Return an error to the caller

### Requirement: Admin Balance Adjustment
The system SHALL allow administrators to manually adjust user balances with full audit trail.

#### Scenario: Admin increases user balance
- **WHEN** an administrator requests to adjust a user's balance with a positive amount
- **THEN** the system SHALL:
  - Create a Payment record with type=ADMIN_ADJUSTMENT
  - Set Payment.performedBy to the administrator's userId
  - Set Payment.metadata containing the reason and note
  - Increment the user's balance by the amount
  - Record an audit log entry with admin details

#### Scenario: Admin decreases user balance
- **WHEN** an administrator requests to adjust a user's balance with a negative amount
- **THEN** the system SHALL:
  - Create a Payment record with type=ADMIN_ADJUSTMENT
  - Set Payment.performedBy to the administrator's userId
  - Set Payment.metadata containing the reason and note
  - Decrement the user's balance by the absolute amount
  - Record an audit log entry with admin details

### Requirement: Withdrawal Refund
The system SHALL synchronize Payment and Withdrawal status when refunding withdrawals.

#### Scenario: Refund rejected withdrawal
- **WHEN** an administrator rejects a withdrawal request
- **THEN** the system SHALL:
  - Create a new Payment record (type=REFUND, withdrawalId set)
  - Increment the user's balance by the withdrawal amount
  - Update the original Payment (type=WITHDRAW) status to CANCELLED
  - Update the Withdrawal status to REJECTED
  - Execute all updates atomically

#### Scenario: Refund failed withdrawal
- **WHEN** a withdrawal fails after approval (e.g., bank transfer failed)
- **THEN** the system SHALL:
  - Create a new Payment record (type=REFUND, withdrawalId set)
  - Increment the user's balance by the withdrawal amount
  - Update the original Payment (type=WITHDRAW) status to CANCELLED
  - Update the Withdrawal status to FAILED
  - Execute all updates atomically

### Requirement: Balance Query
The system SHALL provide methods to query user balance and transaction history.

#### Scenario: Get current balance
- **WHEN** a balance query is requested for a user
- **THEN** the system SHALL return the user's current balance from User.balance field

#### Scenario: Calculate balance from payments
- **WHEN** a balance calculation is requested (for verification purposes)
- **THEN** the system SHALL:
  - Sum all Payment records for the user:
    - RELEASE and REFUND and ADMIN_ADJUSTMENT (positive) add to balance
    - WITHDRAW and ESCROW subtract from balance
  - Return the calculated balance
  - Allow comparison with User.balance to detect inconsistencies

#### Scenario: Get transaction history
- **WHEN** a transaction history query is requested
- **THEN** the system SHALL:
  - Return Payment records for the user
  - Support filtering by type, date range, status
  - Support pagination (limit, offset)
  - Include related data (order, withdrawal, performer)

### Requirement: Transaction Idempotency
The system SHALL prevent duplicate financial operations through optimistic locking.

#### Scenario: Concurrent operations on same user
- **WHEN** two financial operations are requested simultaneously for the same user
- **THEN** the system SHALL:
  - Use database row-level locking on User.balance
  - Execute operations sequentially (not in parallel)
  - Ensure both operations complete successfully without conflict
  - Maintain data consistency

### Requirement: Audit Trail Integration
The system SHALL automatically record audit logs for all financial operations.

#### Scenario: Automatic audit logging
- **WHEN** any financial operation is performed
- **THEN** the system SHALL:
  - Call AuditLogger with operation details
  - Include: userId, amount, type, orderId/withdrawalId, performedBy
  - Record BEFORE creating Payment (to capture failures)
  - NOT fail the financial operation if audit logging fails (log error instead)
