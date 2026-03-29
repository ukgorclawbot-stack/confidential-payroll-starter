# Confidential Payroll Architecture

## Overview

This document outlines a minimum architecture for a confidential payroll system built around Zama's confidential computation model.

The goal is not to define a full enterprise payroll platform. The goal is to define the smallest useful system that demonstrates how payroll execution can happen onchain without exposing sensitive compensation data publicly.

## System objectives

A confidential payroll system should allow:

- an employer to create payroll batches
- employee-specific compensation records to remain confidential
- authorized actors to trigger and manage payroll execution
- employees to receive or claim payments without exposing unnecessary details
- future extension toward bonuses, reimbursements, vesting, and contractor payments

## Core design principle

The most important design principle is simple:

Public execution, confidential values.

This means the system may expose that a payroll cycle happened, but it should not expose the salary amount, bonus amount, or detailed compensation breakdown of each employee to everyone.

## Actors

### Employer

The employer is responsible for:

- creating payroll batches
- defining employee payment records
- approving payroll execution
- funding payroll operations

### Employee

The employee is responsible for:

- receiving a payroll assignment
- viewing authorized payment details
- claiming or confirming payroll receipt if the flow is claim-based

### Payroll operator

The payroll operator may be:

- the employer directly
- an internal finance role
- an authorized service account

Responsibilities include:

- preparing payroll cycles
- reviewing record completeness
- triggering distribution steps

### Auditor or compliance reviewer

This role should not automatically see everything.

The architecture should support selective access, where an authorized reviewer can verify required information without turning the entire payroll dataset into public state.

## Minimum modules

### 1. Payroll batch module

This module creates a payroll cycle.

Example responsibilities:

- create a batch ID
- define payroll period
- store encrypted payroll records
- track batch status

Example states:

- Draft
- Approved
- Funded
- Released
- Claimed
- Closed

### 2. Employee record module

This module maps each employee to a confidential payroll entry.

A payroll entry may contain:

- employee identifier
- encrypted salary amount
- encrypted bonus amount
- encrypted adjustment amount
- encrypted claimable total

This record should not expose raw values publicly.

### 3. Access control module

This module determines who can do what.

Minimum permissions:

- employer can create and approve batches
- operator can prepare and execute authorized actions
- employee can access only their own record
- reviewer can access only the information explicitly granted

### 4. Funding and settlement module

This module ensures the payroll batch is backed by sufficient funds.

Minimum requirements:

- employer deposits funds before release
- batch cannot move to release state without funding
- settlement events should be trackable even if payment details remain confidential

### 5. Claim or distribution module

Two possible MVP patterns:

- Push model:
  the employer triggers payroll distribution directly

- Claim model:
  the employee claims from an assigned confidential balance

For an MVP, the claim model is often easier to reason about because it separates allocation from receipt.

## Data classification

### Data that should remain confidential

- salary amount
- bonus amount
- deductions or adjustments
- employee-specific payout totals
- compensation history per employee

### Data that can be public or semi-public

- payroll batch creation
- batch status transitions
- whether a batch is funded
- whether an employee has claimed
- limited metadata required for operational observability

In the current prototype, that public or semi-public observability is modeled through events, workflow transitions, and a limited public batch summary view rather than unrestricted full-struct reads. Full batch reads are restricted to the employer, operator, or a participating employee.

## Example batch lifecycle

1. Employer creates payroll batch for a defined period
2. Employer or operator adds confidential employee records
3. Employer approves batch
4. Employer funds batch
5. Batch is released
6. Employees claim or receive payments
7. Batch is closed after all records are settled

## Authorization model

A minimum authorization model may include:

- employer wallet
- payroll operator wallet
- employee wallet
- optional reviewer wallet

Recommended design rule:

No actor should see more than what is required for their role.

This is especially important in payroll because privacy leaks are often caused by overbroad internal access, not only public transparency.

## MVP boundaries

This starter architecture does not attempt to solve:

- tax logic
- cross-border payroll compliance
- fiat off-ramp settlement
- HR identity management
- legal employment classification

Those can be future layers.

The MVP should only prove that confidential payroll coordination is possible and understandable for builders.

## Key technical questions for implementation

Before implementation, the builder should answer:

- how are confidential employee records represented?
- how are employee identities mapped to authorized viewers?
- when does a claimable amount become active?
- what information must remain visible for debugging and operations?
- what is the failure recovery flow if a batch is incomplete or underfunded?

## Risk areas

### Authorization mistakes

If access boundaries are too broad, the system loses its privacy value.

### Funding mismatch

If batch totals and available funds fall out of sync, payroll execution becomes unreliable.

### Auditability gaps

If everything is private with no structured verification path, operational trust breaks down.

### Developer usability

If the flow is too hard to reason about, few builders will adopt or extend it.

## Extension ideas

Once the MVP is clear, the same architecture can support:

- recurring payroll
- bonus campaigns
- contractor invoices
- department budgets
- confidential reimbursements
- vesting-based payroll
- selective compliance reporting

## Conclusion

Confidential payroll is one of the strongest real-world examples of why confidential blockchain applications matter.

A good starter architecture should make one thing clear:

Teams should not have to choose between onchain execution and payroll privacy.
