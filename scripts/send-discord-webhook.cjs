const fs = require("node:fs/promises");
const path = require("node:path");

const {
  normalizeBatchReconciliation,
  buildDiscordWebhookPayload,
  resolveOptions,
  loadVaultFromOptions
} = require("./report-batch-reconciliation.cjs");

function parseSendArgs(argv) {
  const options = {
    webhookUrl: null,
    timeoutMs: null,
    payloadFile: null,
    deliveryLogFile: null,
    timestampedPayloadFile: false,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--webhook-url") {
      options.webhookUrl = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--timeout-ms") {
      options.timeoutMs = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (token === "--payload-file") {
      options.payloadFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--delivery-log-file") {
      options.deliveryLogFile = argv[index + 1];
      index += 1;
      continue;
    }

    if (token === "--timestamped-payload-file") {
      options.timestampedPayloadFile = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      options.help = true;
    }
  }

  return options;
}

function resolveSendOptions(argv, env = process.env) {
  const reportOptions = resolveOptions(argv, env);
  const sendOptions = parseSendArgs(argv);

  if (sendOptions.webhookUrl === null && env.DISCORD_WEBHOOK_URL) {
    sendOptions.webhookUrl = env.DISCORD_WEBHOOK_URL;
  }

  if (sendOptions.timeoutMs === null && env.DISCORD_WEBHOOK_TIMEOUT_MS) {
    sendOptions.timeoutMs = Number(env.DISCORD_WEBHOOK_TIMEOUT_MS);
  }

  if (sendOptions.payloadFile === null && env.DISCORD_PAYLOAD_OUTPUT_FILE) {
    sendOptions.payloadFile = env.DISCORD_PAYLOAD_OUTPUT_FILE;
  }

  if (sendOptions.deliveryLogFile === null && env.DISCORD_DELIVERY_LOG_FILE) {
    sendOptions.deliveryLogFile = env.DISCORD_DELIVERY_LOG_FILE;
  }

  if (sendOptions.timeoutMs === null) {
    sendOptions.timeoutMs = 10000;
  }

  if (!sendOptions.dryRun && env.DISCORD_WEBHOOK_DRY_RUN === "true") {
    sendOptions.dryRun = true;
  }

  if (!sendOptions.timestampedPayloadFile && env.DISCORD_PAYLOAD_TIMESTAMPED === "true") {
    sendOptions.timestampedPayloadFile = true;
  }

  return {
    ...reportOptions,
    ...sendOptions
  };
}

function formatTimestampForFile(now) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolvePayloadOutputFile(payloadFile, options = {}) {
  if (!payloadFile) {
    return null;
  }

  if (!options.timestampedPayloadFile) {
    return payloadFile;
  }

  const parsedPath = path.parse(payloadFile);
  const timestamp = formatTimestampForFile(options.now || new Date());
  return path.join(parsedPath.dir, `${parsedPath.name}-${timestamp}${parsedPath.ext}`);
}

function formatDiscordDeliverySummary(report, options = {}) {
  const deliveryStatus = options.dryRun ? "dry-run" : "sent";
  const payloadSuffix = options.payloadFile
    ? ` payloadFile=${options.payloadFile}`
    : "";
  const logSuffix = options.deliveryLogFile
    ? ` logFile=${options.deliveryLogFile}`
    : "";

  return [
    `discordWebhookDelivery: ${deliveryStatus}`,
    `batchId=${report.batchId}`,
    `isFunded=${report.isFunded}`,
    `isCountSettled=${report.isCountSettled}`,
    `isValueSettled=${report.isValueSettled}${payloadSuffix}${logSuffix}`
  ].join(" ");
}

function buildDeliveryLogEntry(report, options = {}, { now = new Date() } = {}) {
  return {
    timestamp: now.toISOString(),
    batchId: report.batchId,
    deliveryStatus: options.dryRun ? "dry-run" : "sent",
    payloadFile: options.payloadFile || null,
    isFunded: report.isFunded,
    isCountSettled: report.isCountSettled,
    isValueSettled: report.isValueSettled
  };
}

function buildDiscordWebhookRequest(webhookUrl, payload) {
  if (!webhookUrl) {
    throw new Error("Missing required DISCORD_WEBHOOK_URL or --webhook-url option.");
  }

  return {
    url: webhookUrl,
    init: {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  };
}

async function readResponseText(response) {
  if (!response || typeof response.text !== "function") {
    return "";
  }

  return response.text();
}

async function sendDiscordWebhook(request, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 10000;

  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation available for Discord webhook delivery.");
  }

  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetchImpl(
      request.url,
      controller
        ? { ...request.init, signal: controller.signal }
        : request.init
    );

    if (!response.ok) {
      const responseText = await readResponseText(response);
      throw new Error(
        `Discord webhook request failed with status ${response.status}: ${responseText || response.statusText || "Unknown error"}`
      );
    }

    return response;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Discord webhook request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

async function persistPayloadIfRequested(payload, payloadFile, fsImpl = fs) {
  if (!payloadFile) {
    return false;
  }

  await fsImpl.mkdir(path.dirname(payloadFile), { recursive: true });
  await fsImpl.writeFile(payloadFile, JSON.stringify(payload, null, 2));
  return true;
}

async function appendDeliveryLogIfRequested(logEntry, deliveryLogFile, fsImpl = fs) {
  if (!deliveryLogFile) {
    return false;
  }

  await fsImpl.mkdir(path.dirname(deliveryLogFile), { recursive: true });
  await fsImpl.appendFile(deliveryLogFile, `${JSON.stringify(logEntry)}\n`);
  return true;
}

function printUsage() {
  console.log("Usage:");
  console.log("  DISCORD_WEBHOOK_URL=<webhook> REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_WEBHOOK_URL=<webhook> REPORT_VAULT_ADDRESS=<vault> REPORT_BATCH_ID=7 npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_PAYLOAD_OUTPUT_FILE=./reports/payload.json DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_PAYLOAD_OUTPUT_FILE=./reports/payload.json DISCORD_PAYLOAD_TIMESTAMPED=true DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_DELIVERY_LOG_FILE=./reports/discord-delivery.jsonl DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
}

async function main() {
  const options = resolveSendOptions(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const mockVault = await loadVaultFromOptions(options);
  const report = normalizeBatchReconciliation(
    options.batchId,
    await mockVault.getBatchReconciliation(options.batchId)
  );
  const payload = buildDiscordWebhookPayload(report);
  const resolvedPayloadFile = resolvePayloadOutputFile(options.payloadFile, options);
  await persistPayloadIfRequested(payload, resolvedPayloadFile);
  const summaryOptions = {
    ...options,
    payloadFile: resolvedPayloadFile
  };

  if (options.dryRun) {
    const logEntry = buildDeliveryLogEntry(report, summaryOptions);
    await appendDeliveryLogIfRequested(logEntry, summaryOptions.deliveryLogFile);
    console.log(JSON.stringify(payload, null, 2));
    console.log(formatDiscordDeliverySummary(report, summaryOptions));
    return;
  }

  const request = buildDiscordWebhookRequest(options.webhookUrl, payload);
  await sendDiscordWebhook(request, { timeoutMs: options.timeoutMs });
  const logEntry = buildDeliveryLogEntry(report, summaryOptions);
  await appendDeliveryLogIfRequested(logEntry, summaryOptions.deliveryLogFile);
  console.log(formatDiscordDeliverySummary(report, summaryOptions));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  parseSendArgs,
  resolveSendOptions,
  resolvePayloadOutputFile,
  buildDeliveryLogEntry,
  formatDiscordDeliverySummary,
  buildDiscordWebhookRequest,
  sendDiscordWebhook,
  persistPayloadIfRequested,
  appendDeliveryLogIfRequested
};
