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

  if (sendOptions.timeoutMs === null) {
    sendOptions.timeoutMs = 10000;
  }

  if (!sendOptions.dryRun && env.DISCORD_WEBHOOK_DRY_RUN === "true") {
    sendOptions.dryRun = true;
  }

  return {
    ...reportOptions,
    ...sendOptions
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

function printUsage() {
  console.log("Usage:");
  console.log("  DISCORD_WEBHOOK_URL=<webhook> REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_WEBHOOK_URL=<webhook> REPORT_VAULT_ADDRESS=<vault> REPORT_BATCH_ID=7 npx hardhat run scripts/send-discord-webhook.cjs");
  console.log("  DISCORD_WEBHOOK_DRY_RUN=true REPORT_DEMO_MODE=partial npx hardhat run scripts/send-discord-webhook.cjs");
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

  if (options.dryRun) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const request = buildDiscordWebhookRequest(options.webhookUrl, payload);
  await sendDiscordWebhook(request, { timeoutMs: options.timeoutMs });
  console.log(`sentDiscordWebhookForBatch: ${report.batchId}`);
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
  buildDiscordWebhookRequest,
  sendDiscordWebhook
};
