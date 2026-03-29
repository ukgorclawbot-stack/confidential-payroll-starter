const assert = require("node:assert/strict");

const {
  parseSendArgs,
  resolveSendOptions,
  resolvePayloadOutputFile,
  buildDiscordWebhookRequest,
  sendDiscordWebhook,
  formatDiscordDeliverySummary,
  persistPayloadIfRequested
} = require("../scripts/send-discord-webhook.cjs");

describe("send-discord-webhook script helpers", function () {
  it("parses webhook sender flags from cli arguments", function () {
    const options = parseSendArgs([
      "--webhook-url", "https://discord.com/api/webhooks/test/token",
      "--timeout-ms", "2500",
      "--dry-run"
    ]);

    assert.equal(options.webhookUrl, "https://discord.com/api/webhooks/test/token");
    assert.equal(options.timeoutMs, 2500);
    assert.equal(options.dryRun, true);
  });

  it("resolves webhook sender options from flags and environment", function () {
    const fromFlag = resolveSendOptions([
      "--demo", "partial",
      "--batch", "7",
      "--webhook-url", "https://discord.com/api/webhooks/flag/token",
      "--timeout-ms", "5000"
    ], {});
    const fromEnv = resolveSendOptions([], {
      REPORT_DEMO_MODE: "settled",
      REPORT_BATCH_ID: "9",
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/env/token",
      DISCORD_WEBHOOK_TIMEOUT_MS: "15000",
      DISCORD_WEBHOOK_DRY_RUN: "true",
      DISCORD_PAYLOAD_OUTPUT_FILE: "./reports/payload.json",
      DISCORD_PAYLOAD_TIMESTAMPED: "true"
    });

    assert.equal(fromFlag.demo, "partial");
    assert.equal(fromFlag.batchId, 7n);
    assert.equal(fromFlag.webhookUrl, "https://discord.com/api/webhooks/flag/token");
    assert.equal(fromFlag.timeoutMs, 5000);

    assert.equal(fromEnv.demo, "settled");
    assert.equal(fromEnv.batchId, 9n);
    assert.equal(fromEnv.webhookUrl, "https://discord.com/api/webhooks/env/token");
    assert.equal(fromEnv.timeoutMs, 15000);
    assert.equal(fromEnv.dryRun, true);
    assert.equal(fromEnv.payloadFile, "./reports/payload.json");
    assert.equal(fromEnv.timestampedPayloadFile, true);
  });

  it("builds a timestamped payload file path when timestamp mode is enabled", function () {
    const timestamped = resolvePayloadOutputFile("/tmp/payload.json", {
      timestampedPayloadFile: true,
      now: new Date("2026-03-29T08:09:10Z")
    });
    const unchanged = resolvePayloadOutputFile("/tmp/payload.json", {
      timestampedPayloadFile: false,
      now: new Date("2026-03-29T08:09:10Z")
    });

    assert.equal(timestamped, "/tmp/payload-20260329T080910Z.json");
    assert.equal(unchanged, "/tmp/payload.json");
  });

  it("formats a short delivery summary with optional payload file information", function () {
    const summary = formatDiscordDeliverySummary({
      batchId: "11",
      isFunded: true,
      isCountSettled: false,
      isValueSettled: false
    }, {
      dryRun: false,
      payloadFile: "/tmp/payload.json"
    });

    assert.match(summary, /discordWebhookDelivery: sent/);
    assert.match(summary, /batchId=11/);
    assert.match(summary, /payloadFile=\/tmp\/payload\.json/);
  });

  it("builds a post request for the discord webhook", function () {
    const payload = {
      username: "Payroll Reconciliation Bot",
      embeds: [{ title: "Batch Reconciliation #1" }]
    };
    const request = buildDiscordWebhookRequest(
      "https://discord.com/api/webhooks/test/token",
      payload
    );

    assert.equal(request.url, "https://discord.com/api/webhooks/test/token");
    assert.equal(request.init.method, "POST");
    assert.equal(request.init.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(request.init.body), payload);
  });

  it("throws a readable error when discord rejects the request", async function () {
    await assert.rejects(
      sendDiscordWebhook(
        buildDiscordWebhookRequest(
          "https://discord.com/api/webhooks/test/token",
          { username: "bot", embeds: [] }
        ),
        {
          timeoutMs: 1000,
          fetchImpl: async () => ({
            ok: false,
            status: 400,
            statusText: "Bad Request",
            text: async () => "invalid webhook"
          })
        }
      ),
      /Discord webhook request failed with status 400: invalid webhook/
    );
  });

  it("writes the payload only when an output path is provided", async function () {
    const calls = [];
    const fsImpl = {
      mkdir: async (directory, options) => {
        calls.push(["mkdir", directory, options]);
      },
      writeFile: async (filePath, content) => {
        calls.push(["writeFile", filePath, content]);
      }
    };

    const payload = {
      username: "Payroll Reconciliation Bot",
      embeds: [{ title: "Batch Reconciliation #5" }]
    };

    const skipped = await persistPayloadIfRequested(payload, null, fsImpl);
    const written = await persistPayloadIfRequested(payload, "/tmp/reports/payload.json", fsImpl);

    assert.equal(skipped, false);
    assert.equal(written, true);
    assert.deepEqual(calls[0], ["mkdir", "/tmp/reports", { recursive: true }]);
    assert.equal(calls[1][0], "writeFile");
    assert.equal(calls[1][1], "/tmp/reports/payload.json");
    assert.deepEqual(JSON.parse(calls[1][2]), payload);
  });
});
