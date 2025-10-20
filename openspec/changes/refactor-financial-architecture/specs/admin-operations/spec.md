# Admin Operations Specification

## MODIFIED Requirements

### Requirement: Admin Refund Processing
The system SHALL allow administrators to approve or reject refund requests with automatic balance updates.

**MODIFIED**: Admin refund approval now uses WalletService to ensure Payment record and balance are synchronized.

#### Scenario: Admin approves refund
- **WHEN** an administrator approves a refund request
- **THEN** the system SHALL:
  - Call WalletService.credit() to:
    - Create Payment (type=REFUND, performedBy=adminId)
    - Increment buyer's balance
  - Update Order status to CANCELLED
  - Update Order.refundStatus to APPROVED
  - Record audit log with admin details
  - **CHANGED**: Previously only created Payment without updating balance

#### Scenario: Admin rejects refund
- **WHEN** an administrator rejects a refund request
- **THEN** the system SHALL:
  - Update Order.refundStatus to REJECTED
  - NOT create any Payment record
  - NOT modify user balance
  - Record audit log with rejection reason
  - **UNCHANGED**: Existing behavior maintained

### Requirement: Admin Balance Adjustment
The system SHALL allow administrators to manually adjust user balances with full audit trail.

**MODIFIED**: Direct balance modification replaced with WalletService.adminAdjustBalance().

#### Scenario: Admin increases user balance
- **WHEN** an administrator increases a user's balance
- **THEN** the system SHALL:
  - Call WalletService.adminAdjustBalance() to:
    - Create Payment (type=ADMIN_ADJUSTMENT, performedBy=adminId)
    - Set metadata containing reason and note
    - Increment user's balance
  - Record audit log entry
  - Return updated user information
  - **CHANGED**: Previously directly updated User.balance without Payment record

#### Scenario: Admin decreases user balance
- **WHEN** an administrator decreases a user's balance
- **THEN** the system SHALL:
  - Validate that user's balance is sufficient
  - Call WalletService.adminAdjustBalance() with negative amount
  - Create Payment record for audit trail
  - Decrement user's balance
  - Record audit log entry
  - **CHANGED**: Previously directly updated User.balance without Payment record

### Requirement: Admin Withdrawal Processing
The system SHALL allow administrators to approve, reject, or mark withdrawals as failed.

**MODIFIED**: Withdrawal rejection and failure now sync Payment status.

#### Scenario: Admin approves withdrawal
- **WHEN** an administrator approves a withdrawal request
- **THEN** the system SHALL:
  - Update Withdrawal status to APPROVED
  - Update associated Payment status to APPROVED
  - Record audit log entry
  - **UNCHANGED**: Balance already deducted during withdrawal request

#### Scenario: Admin rejects withdrawal
- **WHEN** an administrator rejects a withdrawal request
- **THEN** the system SHALL:
  - Call WalletService.refundWithdrawal() to:
    - Create Payment (type=REFUND, withdrawalId set)
    - Increment user's balance
    - Update original Payment(WITHDRAW) status to CANCELLED
  - Update Withdrawal status to REJECTED
  - Record audit log with rejection reason
  - **CHANGED**: Previously only restored balance without syncing Payment status

#### Scenario: Admin marks withdrawal as failed
- **WHEN** an administrator marks an approved withdrawal as failed
- **THEN** the system SHALL:
  - Call WalletService.refundWithdrawal() to:
    - Create Payment (type=REFUND, withdrawalId set)
    - Increment user's balance
    - Update original Payment(WITHDRAW) status to CANCELLED
  - Update Withdrawal status to FAILED
  - Record audit log entry
  - **CHANGED**: Previously only restored balance without syncing Payment status

#### Scenario: Admin completes withdrawal
- **WHEN** an administrator marks a withdrawal as completed
- **THEN** the system SHALL:
  - Update Withdrawal status to COMPLETED
  - Update associated Payment status to COMPLETED
  - Set Payment.transactionId if provided
  - Record audit log entry
  - **CHANGED**: Added Payment status synchronization

## ADDED Requirements

### Requirement: Admin Financial Dashboard
The system SHALL provide administrators with visibility into financial operations.

#### Scenario: View payment performer
- **WHEN** an administrator views payment details
- **THEN** the system SHALL display:
  - Payment type and amount
  - User who received/sent the payment
  - Performer (who initiated the payment, if applicable)
  - Timestamp
  - Associated order or withdrawal

#### Scenario: Filter payments by performer
- **WHEN** an administrator filters payments
- **THEN** the system SHALL support:
  - Filtering by performedBy (admin-initiated operations)
  - Filtering by type (ADMIN_ADJUSTMENT, REFUND, etc.)
  - Date range filtering
  - User filtering

### Requirement: Admin Operation Audit Trail
The system SHALL maintain complete audit trail for all admin financial operations.

#### Scenario: Audit log includes performer
- **WHEN** an admin performs any financial operation
- **THEN** the audit log SHALL contain:
  - Admin userId (performer)
  - Operation type (ADJUST_BALANCE, APPROVE_REFUND, etc.)
  - Target user
  - Old value and new value
  - Reason/note
  - Timestamp
  - IP address and User-Agent

#### Scenario: Query admin operations
- **WHEN** querying audit logs
- **THEN** the system SHALL support:
  - Filtering by admin userId
  - Filtering by operation type
  - Filtering by date range
  - Grouping by admin or target user
  - Export to CSV for compliance

### Requirement: Admin Operation Validation
The system SHALL validate admin operations to prevent errors.

#### Scenario: Prevent negative balance adjustment
- **WHEN** an admin attempts to decrease balance below zero
- **THEN** the system SHALL:
  - Reject the operation
  - Return error "余额不足,无法扣除"
  - NOT create Payment or modify balance

#### Scenario: Require reason for adjustments
- **WHEN** an admin adjusts user balance
- **THEN** the system SHALL:
  - Require a non-empty reason string
  - Reject if reason is missing or empty
  - Store reason in Payment.metadata

#### Scenario: Validate withdrawal amount matches
- **WHEN** processing withdrawal rejection/failure
- **THEN** the system SHALL:
  - Verify the refund amount matches withdrawal.amount
  - Reject if amounts don't match
  - Log error for investigation
