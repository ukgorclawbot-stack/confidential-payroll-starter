# Prototype Plan

## Goal

Move the project from documentation-only into a lightweight workflow prototype without pretending the confidential value layer is already solved onchain.

## What the first prototype includes

The current Solidity skeleton focuses on workflow and state transitions:

- batch creation
- role separation between employer and operator
- employee record registration through opaque digests
- approval flow
- funding registration through a digest
- batch release
- claim registration
- batch closure
- optional vault callbacks through a local mock settlement stub

## What the first prototype intentionally does not include

To keep the prototype honest, the current version does not implement:

- encrypted payroll values onchain
- FHE integration
- token settlement logic
- production-grade vault implementation
- proof verification
- recurring payroll automation

These are future steps, not fake features.

## Why this prototype shape is useful

This approach helps the repository move from pure concept into concrete builder output while keeping the system truthful about its current limits.

It demonstrates:

- the batch lifecycle
- the minimum actor model
- where confidential data references would live
- where settlement and proof systems would later connect

## Current contract split

- `contracts/PayrollTypes.sol`
  Shared enums and structs

- `contracts/IPayrollVault.sol`
  Placeholder settlement interface

- `contracts/MockPayrollVault.sol`
  Minimal local settlement stub for funding and claim callback verification

- `contracts/PayrollManager.sol`
  Workflow-oriented state machine for payroll batches and employee records

## Next recommended steps

### Step 1: Extend the test harness

This repository now has a local Hardhat harness with passing behavior tests.

The next tests should focus on privacy and settlement semantics beyond the current lifecycle and closed-state guards.

### Step 2: Write behavior tests first

Recommended next tests:

- vault error decoding expectations beyond the current custom payroll-layer wrapping
- public batch summary semantics versus restricted batch-detail reads and claim-progress visibility
- event payload stability if the public event surface expands further

### Step 3: Introduce a vault stub

This step is now done through `MockPayrollVault`. The stub now tracks per-batch funding, per-employee settlement state, per-batch settlement counts, callback history, controlled rejection paths, and local event emissions.

### Step 4: Explore confidentiality boundary options

Possible future directions:

- record digests only
- encrypted payload pointers
- proof-based claim validation
- offchain coordinator plus onchain settlement checkpoints

## Validation status

This repository currently validates at the text, compile, and basic behavior-test levels.

Checked:

- file structure
- Markdown consistency
- git diff formatting
- Hardhat compile
- Hardhat test
- record existence visibility aligned with record-viewer permissions
- employee-to-employee claim rejection
- repeated funding registration rejection
- release finality after the first successful transition
- close authorization for non-employer callers
- claim and close isolation across multiple concurrent batches
- non-employer funding and release isolation across multiple concurrent batches
- employer-only approval isolation across multiple concurrent batches
- addRecord isolation across multiple concurrent batches
- claim authorization isolation across multiple concurrent batches
- restricted batch-detail reads for non-participants
- public batch summaries for non-participants
- public batch summaries showing claim progress without exposing full batch details
- public workflow event coverage for core lifecycle transitions
- closed-state restrictions after batch closure
- mock vault funding and settlement callback history behavior
- mock vault per-batch funding state tracking
- mock vault per-batch settlement count tracking
- mock vault duplicate funding and settlement rejection
- mock vault funding and settlement event emissions
- vault-side rejection rollback behavior
- payroll-layer custom error wrapping for vault callback failures

Not yet checked:

- FHE-specific integrations
- external vault integration
- production deployment assumptions
- broader edge-case coverage
