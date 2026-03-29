# Scripts

This directory now contains small helper scripts for local prototype inspection.

## Current scripts

- `report-batch-reconciliation.cjs`
  Reads `MockPayrollVault.getBatchReconciliation(batchId)` and prints a readable report.

## Quick usage

Run a partial demo batch:

```bash
npm run report:demo
```

Run a fully settled demo batch:

```bash
npm run report:demo:settled
```

Query an existing deployed mock vault:

```bash
REPORT_VAULT_ADDRESS=<vault-address> REPORT_BATCH_ID=7 npx hardhat run scripts/report-batch-reconciliation.cjs
```

The script is intentionally read-only from the reporting side. In demo mode it deploys a temporary local `MockPayrollVault`, seeds one example batch, and prints the resulting reconciliation summary.
