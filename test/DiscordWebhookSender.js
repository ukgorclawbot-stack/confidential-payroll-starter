const assert = require("node:assert/strict");

const {
  parseSendArgs,
  resolveSendOptions,
  buildDiscordWebhookRequest,
  sendDiscordWebhook
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
      DISCORD_WEBHOOK_DRY_RUN: "true"
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
});
