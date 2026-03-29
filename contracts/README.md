# Contracts

This directory now contains the first workflow-oriented Solidity skeleton for the confidential payroll starter.

The current contract set is intentionally narrow. It models batch lifecycle, role separation, confidential record digests, and claim tracking without pretending the confidential value layer or settlement layer is fully implemented yet.

## Current files

- `PayrollTypes.sol`
  Shared enums and structs

- `IPayrollVault.sol`
  Placeholder settlement interface for future funding and payout integration

- `MockPayrollVault.sol`
  Minimal local vault stub used by the Hardhat test suite, including callback history and controlled rejection toggles

- `PayrollManager.sol`
  Workflow-oriented state machine for payroll batches, employee record digests, and optional vault callbacks

## Planned purpose

This directory may later expand to include:

- concrete vault implementation
- proof verification hooks
- claim validation logic
- fuller access control modules
- deeper settlement integrations

## MVP implementation goals

A minimum implementation would likely explore the following flow:

1. Create payroll batch
2. Add confidential employee records
3. Approve batch
4. Fund batch
5. Release batch
6. Allow employee claim or controlled distribution
7. Close batch

## Key implementation questions

Before code is written, the following questions should be answered:

- how should confidential values be represented?
- how should employee access be enforced?
- what should remain public for operational visibility?
- how should funding status be tracked?
- should the MVP use a claim model or push model?
- how should failures or partial settlement be handled?

## Why the implementation is still limited

Confidential payroll involves privacy boundaries, actor design, authorization, settlement behavior, and eventually proof or encrypted data handling.

The current implementation therefore stays honest about scope:

- workflow is modeled onchain
- confidential values are represented only as digests
- settlement is deferred behind an interface
- proof systems are not yet implemented

## Current local validation

The current prototype is locally exercised through the Hardhat test suite, including:

- batch lifecycle guards
- role-based restrictions
- record existence privacy aligned with record-viewer permissions
- employee self-claim behavior
- employee-to-employee claim rejection
- repeated funding registration rejection after the batch reaches `Funded`
- release finality after the batch reaches `Released`
- close authorization restricted to the employer
- claim state and close conditions isolated per batch
- funding and release authorization isolated per batch
- approval authorization isolated per batch employer
- add-record authorization isolated per batch
- claim authorization isolated per batch
- batch-detail reads isolated to batch participants
- public batch summaries exposed without full batch-detail reads
- public workflow event emissions covered by local regression tests
- final-state restrictions after batch closure
- vault callback registration history for funding and settlement
- vault per-batch funding state and per-employee settlement state tracking
- vault settlement counts isolated per batch
- vault event emissions covered for funding and settlement registration
- vault rejection of duplicate funding and duplicate settlement writes
- vault-side rejection rollback for funding and settlement registration
- payroll-layer custom errors for vault callback failures

## Next step

The next milestone should be:

- decide whether the mock vault should evolve into a value-accounting stub or remain a callback-verification harness
- extend the prototype without overstating confidentiality guarantees
