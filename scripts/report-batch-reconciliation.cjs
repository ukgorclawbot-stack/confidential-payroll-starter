const hre = require("hardhat");

const { ethers } = hre;

function toPlainString(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  return String(value);
}

function normalizeBatchReconciliation(batchId, summary) {
  return {
    batchId: toPlainString(batchId),
    isFunded: Boolean(summary.isFunded),
    isCountSettled: Boolean(summary.isCountSettled),
    isValueSettled: Boolean(summary.isValueSettled),
    expectedSettlementCount: toPlainString(summary.expectedSettlementCount),
    settlementCount: toPlainString(summary.settlementCount),
    remainingSettlementCount: toPlainString(summary.remainingSettlementCount),
    fundingAmount: toPlainString(summary.fundingAmount),
    settledAmount: toPlainString(summary.settledAmount),
    remainingFundingAmount: toPlainString(summary.remainingFundingAmount)
  };
}

function formatBatchReconciliation(report) {
  return [
    "Batch Reconciliation Report",
    `batchId: ${report.batchId}`,
    `isFunded: ${report.isFunded}`,
    `isCountSettled: ${report.isCountSettled}`,
    `isValueSettled: ${report.isValueSettled}`,
    `expectedSettlementCount: ${report.expectedSettlementCount}`,
    `settlementCount: ${report.settlementCount}`,
    `remainingSettlementCount: ${report.remainingSettlementCount}`,
    `fundingAmount: ${report.fundingAmount}`,
    `settledAmount: ${report.settledAmount}`,
    `remainingFundingAmount: ${report.remainingFundingAmount}`
  ].join("\n");
}

function serializeBatchReconciliation(report) {
  return JSON.stringify(report, null, 2);
}

function buildDiscordWebhookPayload(report) {
  let color = 15158332;

  if (report.isCountSettled && report.isValueSettled) {
    color = 5763719;
  } else if (report.isFunded) {
    color = 16098851;
  }

  return {
    username: "Payroll Reconciliation Bot",
    embeds: [
      {
        title: `Batch Reconciliation #${report.batchId}`,
        color,
        description: [
          `Funded: ${report.isFunded}`,
          `Count settled: ${report.isCountSettled}`,
          `Value settled: ${report.isValueSettled}`
        ].join("\n"),
        fields: [
          {
            name: "Settlement Progress",
            value: [
              `expectedSettlementCount: ${report.expectedSettlementCount}`,
              `settlementCount: ${report.settlementCount}`,
              `remainingSettlementCount: ${report.remainingSettlementCount}`
            ].join("\n"),
            inline: true
          },
          {
            name: "Value Accounting",
            value: [
              `fundingAmount: ${report.fundingAmount}`,
              `settledAmount: ${report.settledAmount}`,
              `remainingFundingAmount: ${report.remainingFundingAmount}`
            ].join("\n"),
            inline: true
          }
        ],
        footer: {
          text: "confidential-payroll-starter mock vault"
        }
      }
    ]
  };
}

function parseArgs(argv) {
  const options = {
    batchId: null,
    demo: null,
    address: null,
    output: null
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--batch") {
      options.batchId = BigInt(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === "--address") {
      options.address = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--demo") {
      options.demo = argv[index + 1] || "partial";
      index += 1;
      continue;
    }

    if (token === "--json") {
      options.output = "json";
      continue;
    }

    if (token === "--discord") {
      options.output = "discord";
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function resolveOptions(argv, env = process.env) {
  const options = parseArgs(argv);

  if (options.address === null && env.REPORT_VAULT_ADDRESS) {
    options.address = env.REPORT_VAULT_ADDRESS;
  }

  if (options.demo === null && env.REPORT_DEMO_MODE) {
    options.demo = env.REPORT_DEMO_MODE;
  }

  if (options.batchId === null && env.REPORT_BATCH_ID) {
    options.batchId = BigInt(env.REPORT_BATCH_ID);
  }

  if (options.batchId === null) {
    options.batchId = 1n;
  }

  if (options.output === null && env.REPORT_OUTPUT) {
    options.output = env.REPORT_OUTPUT;
  }

  if (options.output === null) {
    options.output = "text";
  }

  return options;
}

function printUsage() {
  console.log("Usage:");
  console.log("  REPORT_DEMO_MODE=partial npx hardhat run scripts/report-batch-reconciliation.cjs");
  console.log("  REPORT_DEMO_MODE=settled REPORT_BATCH_ID=2 npx hardhat run scripts/report-batch-reconciliation.cjs");
  console.log("  REPORT_VAULT_ADDRESS=<vault> REPORT_BATCH_ID=7 npx hardhat run scripts/report-batch-reconciliation.cjs");
  console.log("  REPORT_DEMO_MODE=partial REPORT_OUTPUT=json npx hardhat run scripts/report-batch-reconciliation.cjs");
}

async function seedDemoBatch(mockVault, caller, batchId, demoMode) {
  const settlementDigestA = ethers.id(`demo-settlement-${batchId}-a`);
  const settlementDigestB = ethers.id(`demo-settlement-${batchId}-b`);
  const [, employeeA, employeeB] = await ethers.getSigners();

  await (await mockVault
    .connect(caller)
    .registerFunding(batchId, caller.address, ethers.id(`demo-funding-${batchId}`))).wait();
  await (await mockVault.connect(caller).setExpectedSettlementCount(batchId, 2)).wait();
  await (await mockVault.connect(caller).setFundingAmount(batchId, 1000)).wait();
  await (await mockVault.connect(caller).setSettlementAmount(settlementDigestA, 400)).wait();
  await (await mockVault.connect(caller).setSettlementAmount(settlementDigestB, 600)).wait();
  await (await mockVault
    .connect(caller)
    .registerSettlement(batchId, employeeA.address, settlementDigestA)).wait();

  if (demoMode === "settled") {
    await (await mockVault
      .connect(caller)
      .registerSettlement(batchId, employeeB.address, settlementDigestB)).wait();
  }
}

async function loadVaultFromOptions(options) {
  const MockPayrollVault = await ethers.getContractFactory("MockPayrollVault");

  if (options.demo) {
    const [caller] = await ethers.getSigners();
    const mockVault = await MockPayrollVault.connect(caller).deploy();
    await mockVault.waitForDeployment();
    await seedDemoBatch(mockVault, caller, options.batchId, options.demo);
    return mockVault;
  }

  if (!options.address) {
    throw new Error("Missing required --address or --demo option.");
  }

  return MockPayrollVault.attach(options.address);
}

async function main() {
  const options = resolveOptions(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const mockVault = await loadVaultFromOptions(options);
  const report = normalizeBatchReconciliation(
    options.batchId,
    await mockVault.getBatchReconciliation(options.batchId)
  );

  if (options.output === "json") {
    console.log(serializeBatchReconciliation(report));
    return;
  }

  if (options.output === "discord") {
    console.log(JSON.stringify(buildDiscordWebhookPayload(report), null, 2));
    return;
  }

  if (options.demo) {
    console.log(`demoMode: ${options.demo}`);
  }
  if (options.address) {
    console.log(`vaultAddress: ${options.address}`);
  }
  console.log(formatBatchReconciliation(report));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeBatchReconciliation,
  formatBatchReconciliation,
  serializeBatchReconciliation,
  buildDiscordWebhookPayload,
  parseArgs,
  resolveOptions,
  loadVaultFromOptions
};
