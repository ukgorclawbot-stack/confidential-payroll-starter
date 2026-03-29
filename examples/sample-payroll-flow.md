# Sample Payroll Flow

## Scenario

A company wants to run a monthly payroll cycle on top of a confidential blockchain application built with Zama.

The company wants the process to be operationally visible, but it does not want employee compensation data to be publicly exposed.

## Participants

- Employer: Acme Labs
- Payroll operator: Finance Ops wallet
- Employee A: Alice
- Employee B: Bob

## Payroll period

- Period: January 2026
- Batch ID: PAYROLL-2026-01

## Step 1: Create payroll batch

The employer creates a new payroll batch.

Publicly visible information may include:

- batch ID
- payroll period
- creation timestamp
- current batch status

The initial status is:

- Draft

No employee salary data is public at this stage.

## Step 2: Add confidential employee records

The payroll operator prepares employee payment entries.

Example internal records:

- Alice
  - base salary: confidential
  - bonus: confidential
  - adjustment: confidential
  - total claimable: confidential

- Bob
  - base salary: confidential
  - bonus: confidential
  - adjustment: confidential
  - total claimable: confidential

What the public sees:

- employee count in batch, if exposed at all
- batch still in Draft or Prepared state

What the public should not see:

- any raw compensation number
- comparison between Alice and Bob
- internal pay structure

## Step 3: Employer approves the batch

The employer reviews the prepared batch and approves it.

Publicly visible information:

- batch status changed to Approved
- approval timestamp

Still confidential:

- employee-level payroll values
- total salary per employee
- internal adjustment details

## Step 4: Fund the batch

The employer deposits enough assets to settle the payroll cycle.

Publicly visible information may include:

- batch status changed to Funded
- proof that the batch has been funded
- transaction reference for treasury movement

Confidential information remains protected.

## Step 5: Release payroll

The payroll operator triggers release.

This means the batch is now active for settlement or employee claiming.

Publicly visible information:

- batch status changed to Released

Employees can now access their own authorized payment record.

## Step 6: Employee claim flow

### Alice

Alice opens the payroll interface and sees only her own confidential entry.

She can verify:

- that a payroll record exists for her
- that a claimable amount is available
- the amount she is authorized to view

She claims her payroll.

Publicly visible information:

- Alice claimed from batch PAYROLL-2026-01

Confidential information:

- Alice's salary amount
- bonus amount
- adjustment amount

### Bob

Bob follows the same process.

Again, the system may show that Bob has claimed, but not how much Bob received.

## Step 7: Close batch

Once all records are settled, the batch is closed.

Publicly visible information:

- batch status changed to Closed
- settlement completion timestamp

Confidential information remains protected in storage and access rules.

## What this example demonstrates

This flow shows how a payroll system can expose operational milestones without exposing confidential compensation details.

Visible:

- a payroll batch exists
- it was approved
- it was funded
- it was released
- claims happened
- the batch was closed

Not visible:

- each employee's salary
- bonus structure
- internal compensation hierarchy
- exact payroll totals per person

## Why this matters

A transparent blockchain is excellent for many use cases, but payroll is not one of the cases where full transparency is acceptable.

This example shows why confidential execution is valuable:

- employees keep compensation privacy
- employers avoid revealing internal financial structure
- operators still get an onchain coordination workflow
- builders get a clear real-world pattern to extend

## Next extensions

This sample flow can later be expanded to include:

- recurring monthly payroll
- role-based bonuses
- contractor payments
- reimbursement flows
- vesting-linked compensation
- selective auditor access
