# Financial Transactions Specification

## ADDED Requirements

### Requirement: Payment-Withdrawal Association
The system SHALL maintain bidirectional association between Payment and Withdrawal records.

#### Scenario: Create withdrawal with payment
- **WHEN** a user requests a withdrawal
- **THEN** the system SHALL:
  - Create a Withdrawal record (status=PENDING)
  - Create a Payment record (type=WITHDRAW, status=PENDING)
  - Set Payment.withdrawalId to the Withdrawal.id
  - Decrement user's balance by the withdrawal amount
  - Execute all operations atomically

#### Scenario: Query payments by withdrawal
- **WHEN** a withdrawal's payment history is requested
- **THEN** the system SHALL:
  - Return all Payment records where withdrawalId = withdrawal.id
  - Include the original WITHDRAW payment
  - Include any REFUND payments (if rejected/failed)
  - Order by createdAt ascending

#### Scenario: Query withdrawal by payment
- **WHEN** a payment's related withdrawal is requested
- **THEN** the system SHALL:
  - Return the Withdrawal record associated with Payment.withdrawalId
  - Return null if the payment is not withdrawal-related

### Requirement: Payment Metadata
The system SHALL store additional context in Payment.metadata for audit and debugging.

#### Scenario: Admin adjustment metadata
- **WHEN** an admin adjusts user balance
- **THEN** Payment.metadata SHALL contain:
  - `reason`: String - Reason for adjustment (required)
  - `note`: String - Additional notes (optional)
  - `adminUserId`: String - ID of the administrator
  - `relatedOrderNo`: String - Related order number (if applicable)

#### Scenario: Withdrawal refund metadata
- **WHEN** a withdrawal is refunded (rejected/failed)
- **THEN** Payment(type=REFUND).metadata SHALL contain:
  - `withdrawalId`: String - ID of the related withdrawal
  - `originalPaymentId`: String - ID of the original WITHDRAW payment
  - `refundReason`: String - Reason for refund (e.g., "管理员拒绝提现")
  - `adminUserId`: String - ID of the administrator (if applicable)

### Requirement: Payment Performer Tracking
The system SHALL record the performer of financial operations for accountability.

#### Scenario: System-initiated payment
- **WHEN** a payment is created by system logic (e.g., buyer pays order)
- **THEN** Payment.performedBy SHALL be:
  - The user who initiated the action (buyerId for ESCROW)
  - NULL for automatic operations (e.g., auto-confirm)

#### Scenario: Admin-initiated payment
- **WHEN** a payment is created by administrator action
- **THEN** Payment.performedBy SHALL be:
  - The administrator's userId
  - Stored in performedBy field for audit trail
  - Included in audit log entry

### Requirement: Payment Type Extensions
The system SHALL support new payment types for administrative operations.

#### Scenario: Admin adjustment payment type
- **WHEN** an administrator manually adjusts user balance
- **THEN** the Payment record SHALL:
  - Use type=ADMIN_ADJUSTMENT
  - NOT be associated with any order (orderId=null)
  - Contain full context in metadata field
  - Include performedBy pointing to admin user

### Requirement: Payment Status Synchronization
The system SHALL keep Payment and related entity status synchronized.

#### Scenario: Withdrawal rejection syncs payment
- **WHEN** a Withdrawal is rejected
- **THEN** the system SHALL:
  - Update the original Payment(type=WITHDRAW) status to CANCELLED
  - Create a new Payment(type=REFUND) with status=COMPLETED
  - Both payments reference the same withdrawalId

#### Scenario: Withdrawal completion syncs payment
- **WHEN** a Withdrawal is completed
- **THEN** the system SHALL:
  - Update the Payment(type=WITHDRAW) status to COMPLETED
  - Set Payment.transactionId if provided
  - NOT create additional payment records

### Requirement: Balance Calculation Consistency
The system SHALL ensure User.balance always matches sum of Payment records.

#### Scenario: Balance matches payment sum
- **WHEN** any financial operation completes
- **THEN** the following equation SHALL hold:
  ```
  User.balance =
    SUM(Payment.amount WHERE type IN ['RELEASE', 'REFUND']) +
    SUM(Payment.amount WHERE type = 'ADMIN_ADJUSTMENT' AND amount > 0) -
    SUM(Payment.amount WHERE type IN ['WITHDRAW', 'ESCROW']) -
    SUM(Payment.amount WHERE type = 'ADMIN_ADJUSTMENT' AND amount < 0)
  ```

#### Scenario: Verification detects inconsistency
- **WHEN** a balance verification script runs
- **THEN** the system SHALL:
  - Calculate balance from Payment records
  - Compare with User.balance field
  - Report any discrepancies with userId and amounts
  - Provide suggested corrections (admin adjustments needed)

### Requirement: Transaction Atomicity
The system SHALL ensure Payment creation and balance update are atomic.

#### Scenario: Payment creation and balance update
- **WHEN** any financial operation is performed
- **THEN** the system SHALL:
  - Use a database transaction wrapping:
    - Payment record creation
    - User balance update
    - Related entity updates (Order, Withdrawal)
  - Commit all changes together
  - Rollback ALL changes if any operation fails

#### Scenario: Partial failure rollback
- **WHEN** a financial operation fails mid-transaction
- **THEN** the system SHALL:
  - Rollback the Payment record (not created in database)
  - Rollback the balance update (User.balance unchanged)
  - Return error to caller
  - NOT leave orphaned data

### Requirement: Historical Data Compatibility
The system SHALL handle Payment records created before this refactoring.

#### Scenario: Legacy payment without metadata
- **WHEN** querying a Payment record created before refactoring
- **THEN** the system SHALL:
  - Treat Payment.metadata as null (not error)
  - Treat Payment.performedBy as null or 'SYSTEM'
  - Display legacy data with appropriate labels in UI

#### Scenario: Legacy withdrawal without payment
- **WHEN** a Withdrawal record has no associated Payment
- **THEN** the system SHALL:
  - Allow the withdrawal to function normally
  - Optionally create missing Payment via migration script
  - Log a warning for audit purposes
