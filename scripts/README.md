# Scripts

This directory now contains small helper scripts for local prototype inspection.

## Current scripts

- `report-batch-reconciliation.cjs`
  Reads `MockPayrollVault.getBatchReconciliation(batchId)` and prints a readable report.

- `send-discord-webhook.cjs`
  Reuses the reconciliation report flow and delivers the Discord webhook payload to a real webhook URL.

- `publish-subtree.sh`
  Publishes the committed `confidential-payroll-starter/` subtree history to GitHub.

## Quick usage

Run a partial demo batch:

```bash
npm run report:demo
```

Run a fully settled demo batch:

```bash
npm run report:demo:settled
```

Run a partial demo batch as JSON:

```bash
npm run report:demo:json
```

Run a partial demo batch as a Discord webhook payload:

```bash
npm run report:demo:discord
```

Preview the webhook payload that would be sent:

```bash
npm run report:demo:discord:send:dry-run
```

Send a partial demo batch to a real Discord webhook:

```bash
DISCORD_WEBHOOK_URL=<your-webhook-url> npm run report:demo:discord:send
```

Dry-run the GitHub subtree publish command:

```bash
npm run publish:github:dry-run
```

Publish the committed subtree history to GitHub:

```bash
npm run publish:github
```

Query an existing deployed mock vault:

```bash
REPORT_VAULT_ADDRESS=<vault-address> REPORT_BATCH_ID=7 npx hardhat run scripts/report-batch-reconciliation.cjs
```

The script is intentionally read-only from the reporting side. In demo mode it deploys a temporary local `MockPayrollVault`, seeds one example batch, and prints the resulting reconciliation summary.

To force JSON output for any invocation:

```bash
REPORT_OUTPUT=json npx hardhat run scripts/report-batch-reconciliation.cjs
```

To force Discord webhook payload output:

```bash
REPORT_OUTPUT=discord npx hardhat run scripts/report-batch-reconciliation.cjs
```

To deliver the webhook directly from the CLI:

```bash
DISCORD_WEBHOOK_URL=<your-webhook-url> REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs
```

Optional sender flags:

```bash
DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs
DISCORD_WEBHOOK_URL=<your-webhook-url> DISCORD_WEBHOOK_TIMEOUT_MS=15000 REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs
```

The publish helper only pushes committed changes and aborts if the subtree path is dirty.
