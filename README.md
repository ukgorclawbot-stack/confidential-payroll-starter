# Confidential Payroll Starter Pack for Zama

A documentation-first starter project exploring how confidential payroll can be built on top of Zama.

## What this is

This repository is a builder-oriented starter pack for one practical use case: payroll that can be coordinated onchain without exposing sensitive compensation data publicly.

It focuses on a simple question:

How should a confidential payroll system work if we want public execution, but private values?

## Why this matters

Traditional onchain systems are transparent by default. That works for many applications, but payroll is different.

A transparent payroll system can reveal:

- salary levels
- bonus structure
- internal team hierarchy
- contractor relationships
- treasury behavior tied to operations

This project explores how Zama can support a better model for real-world business workflows.

## Repository contents

- `docs/concept-note.md`
  High-level problem statement and project intent

- `docs/architecture.md`
  Minimum system design, actor model, privacy boundaries, and workflow structure

- `docs/tutorial-confidential-payroll.md`
  Builder-friendly walkthrough of the use case

- `examples/sample-payroll-flow.md`
  Example lifecycle of a confidential payroll batch

- `docs/prototype-plan.md`
  Explains the current prototype boundary and next implementation steps

- `contracts/PayrollTypes.sol`
  Shared enums and structs for payroll workflow modeling

- `contracts/IPayrollVault.sol`
  Future settlement-layer interface

- `contracts/MockPayrollVault.sol`
  Minimal local vault stub used to verify funding and settlement callbacks, history, rejection paths, batch-settlement completion semantics, and optional value-accounting behavior

- `contracts/PayrollManager.sol`
  Workflow-oriented prototype contract for batch lifecycle, claim tracking, and optional vault callbacks

- `test/PayrollManager.js`
  First local lifecycle tests for the payroll workflow skeleton

- `hardhat.config.cjs`
  Minimal local Hardhat configuration for compile and test

- `package.json`
  Local scripts and dev dependencies for the prototype harness

- `scripts/report-batch-reconciliation.cjs`
  Read-only helper for printing `MockPayrollVault` batch reconciliation summaries

- `scripts/`
  Helper scripts and usage notes for local reporting flows

## MVP goal

The MVP focuses on:

1. creating a payroll batch
2. assigning confidential employee records
3. approving the batch
4. funding the batch
5. releasing or claiming payments
6. closing the batch

## Status

Early builder contribution with a documentation-first workflow prototype.

Current local validation includes:

- Hardhat compile
- 71 passing tests across `PayrollManager`, `MockPayrollVault`, and reporting helpers
- batch details visible only to the batch employer, operator, or participating employee
- public batch summaries available without exposing the full batch struct
- public batch summaries expose workflow progress only through status, payroll period, employee count, claimed count, remaining claims, close readiness, and funding presence
- public workflow events covered for batch creation, record registration, approval, funding, claiming, and closure
- zero-address and empty-digest guardrails covered for batch creation, record registration, funding, and claiming
- missing-batch summary reads rejected with an explicit error
- record existence visibility aligned with record-viewer permissions
- employee claim permissions restricted to the record owner, employer, or operator
- repeated funding registration blocked after the first successful funding transition
- release transition blocked after the first successful release and after later states
- batch closure restricted to the employer even after all claims are settled
- claim and close state isolated across multiple concurrent batches
- funding and release permissions isolated to each batch's assigned operator or employer
- approval restricted to each batch's own employer, even across concurrent batches
- addRecord permissions isolated to each batch's own employer or operator
- claim permissions isolated to each batch's own employer, operator, or target employee
- final-state restrictions after batch closure
- mock vault callback verification for funding and settlement history
- mock vault per-batch funding and per-employee settlement state tracking
- mock vault settlement counts isolated per batch
- mock vault expected-settlement targets, remaining-settlement tracking, and settled-batch marking
- mock vault optional funding-amount, settled-amount, and remaining-funding accounting
- mock vault batch-level reconciliation reporting for settlement counts and value accounting
- mock vault funding and settlement event emissions covered by local tests
- mock vault value-accounting event coverage and over-settlement rejection
- mock vault rejection of duplicate funding and duplicate settlement writes
- mock vault rejection of extra settlements after a batch is marked settled
- local reconciliation report script with demo mode and formatter helper coverage
- vault-side rejection rollback coverage for funding and settlement registration
- payroll-layer custom errors for wrapped vault callback failures

The repository still does not claim FHE integration or production-ready settlement logic.

## Reference

- Zama Developer Program:
  https://www.zama.org/post/zama-developer-program-mainnet-season1-building-for-the-long-game
