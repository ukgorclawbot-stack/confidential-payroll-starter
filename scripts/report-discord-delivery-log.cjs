const fs = require("node:fs/promises");

function parseLogReportArgs(argv) {
  const options = {
    logFile: null,
    output: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--file") {
      options.logFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--json") {
      options.output = "json";
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function resolveLogReportOptions(argv, env = process.env) {
  const options = parseLogReportArgs(argv);

  if (options.logFile === null && env.DISCORD_DELIVERY_LOG_FILE) {
    options.logFile = env.DISCORD_DELIVERY_LOG_FILE;
  }

  if (options.output === null && env.REPORT_OUTPUT) {
    options.output = env.REPORT_OUTPUT;
  }

  if (options.output === null) {
    options.output = "text";
  }

  return options;
}

function parseDeliveryLog(content) {
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function summarizeDeliveryLog(entries) {
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      sentCount: 0,
      dryRunCount: 0,
      latestBatchId: null,
      latestTimestamp: null
    };
  }

  const latestEntry = entries.reduce((latest, current) => {
    if (!latest) {
      return current;
    }

    return current.timestamp > latest.timestamp ? current : latest;
  }, null);

  return {
    totalEntries: entries.length,
    sentCount: entries.filter((entry) => entry.deliveryStatus === "sent").length,
    dryRunCount: entries.filter((entry) => entry.deliveryStatus === "dry-run").length,
    latestBatchId: latestEntry.batchId,
    latestTimestamp: latestEntry.timestamp
  };
}

function formatDeliveryLogSummary(summary) {
  return [
    "Discord Delivery Log Summary",
    `totalEntries: ${summary.totalEntries}`,
    `sentCount: ${summary.sentCount}`,
    `dryRunCount: ${summary.dryRunCount}`,
    `latestBatchId: ${summary.latestBatchId ?? "none"}`,
    `latestTimestamp: ${summary.latestTimestamp ?? "none"}`
  ].join("\n");
}

function printUsage() {
  console.log("Usage:");
  console.log("  DISCORD_DELIVERY_LOG_FILE=./reports/discord-delivery.jsonl npx hardhat run scripts/report-discord-delivery-log.cjs");
  console.log("  DISCORD_DELIVERY_LOG_FILE=./reports/discord-delivery.jsonl REPORT_OUTPUT=json npx hardhat run scripts/report-discord-delivery-log.cjs");
}

async function main() {
  const options = resolveLogReportOptions(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.logFile) {
    throw new Error("Missing required DISCORD_DELIVERY_LOG_FILE or --file option.");
  }

  const content = await fs.readFile(options.logFile, "utf8");
  const summary = summarizeDeliveryLog(parseDeliveryLog(content));

  if (options.output === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`logFile: ${options.logFile}`);
  console.log(formatDeliveryLogSummary(summary));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseDeliveryLog,
  summarizeDeliveryLog,
  formatDeliveryLogSummary,
  resolveLogReportOptions
};
