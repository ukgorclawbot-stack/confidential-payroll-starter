const assert = require("node:assert/strict");

const {
  parseDeliveryLog,
  summarizeDeliveryLog,
  formatDeliveryLogSummary,
  resolveLogReportOptions
} = require("../scripts/report-discord-delivery-log.cjs");

describe("report-discord-delivery-log script helpers", function () {
  it("parses jsonl delivery log content into entries", function () {
    const entries = parseDeliveryLog([
      "{\"timestamp\":\"2026-03-29T12:00:00.000Z\",\"batchId\":\"1\",\"deliveryStatus\":\"dry-run\"}",
      "{\"timestamp\":\"2026-03-29T12:05:00.000Z\",\"batchId\":\"2\",\"deliveryStatus\":\"sent\"}",
      ""
    ].join("\n"));

    assert.equal(entries.length, 2);
    assert.equal(entries[0].batchId, "1");
    assert.equal(entries[1].deliveryStatus, "sent");
  });

  it("summarizes delivery log counts and latest activity", function () {
    const summary = summarizeDeliveryLog([
      { timestamp: "2026-03-29T12:00:00.000Z", batchId: "1", deliveryStatus: "dry-run" },
      { timestamp: "2026-03-29T12:05:00.000Z", batchId: "2", deliveryStatus: "sent" },
      { timestamp: "2026-03-29T12:10:00.000Z", batchId: "3", deliveryStatus: "sent" }
    ]);

    assert.equal(summary.totalEntries, 3);
    assert.equal(summary.sentCount, 2);
    assert.equal(summary.dryRunCount, 1);
    assert.equal(summary.latestBatchId, "3");
    assert.equal(summary.latestTimestamp, "2026-03-29T12:10:00.000Z");
  });

  it("formats a readable delivery log summary", function () {
    const output = formatDeliveryLogSummary({
      totalEntries: 4,
      sentCount: 3,
      dryRunCount: 1,
      latestBatchId: "9",
      latestTimestamp: "2026-03-29T12:30:00.000Z"
    });

    assert.match(output, /Discord Delivery Log Summary/);
    assert.match(output, /totalEntries: 4/);
    assert.match(output, /latestBatchId: 9/);
  });

  it("resolves the log report file path and output mode from flags or environment", function () {
    const fromFlag = resolveLogReportOptions([
      "--file", "./reports/discord-delivery.jsonl",
      "--json"
    ], {});
    const fromEnv = resolveLogReportOptions([], {
      DISCORD_DELIVERY_LOG_FILE: "./reports/from-env.jsonl",
      REPORT_OUTPUT: "json"
    });

    assert.equal(fromFlag.logFile, "./reports/discord-delivery.jsonl");
    assert.equal(fromFlag.output, "json");
    assert.equal(fromEnv.logFile, "./reports/from-env.jsonl");
    assert.equal(fromEnv.output, "json");
  });
});
