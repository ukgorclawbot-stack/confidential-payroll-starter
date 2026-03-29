const assert = require("node:assert/strict");

const {
  normalizeBatchReconciliation,
  formatBatchReconciliation,
  serializeBatchReconciliation,
  buildDiscordWebhookPayload,
  resolveOptions
} = require("../scripts/report-batch-reconciliation.cjs");

describe("report-batch-reconciliation script helpers", function () {
  it("normalizes onchain reconciliation data into plain report fields", function () {
    const report = normalizeBatchReconciliation(7n, {
      isFunded: true,
      isCountSettled: false,
      isValueSettled: true,
      expectedSettlementCount: 3n,
      settlementCount: 2n,
      remainingSettlementCount: 1n,
      fundingAmount: 1000n,
      settledAmount: 1000n,
      remainingFundingAmount: 0n
    });

    assert.deepEqual(report, {
      batchId: "7",
      isFunded: true,
      isCountSettled: false,
      isValueSettled: true,
      expectedSettlementCount: "3",
      settlementCount: "2",
      remainingSettlementCount: "1",
      fundingAmount: "1000",
      settledAmount: "1000",
      remainingFundingAmount: "0"
    });
  });

  it("formats a readable reconciliation report", function () {
    const output = formatBatchReconciliation({
      batchId: "12",
      isFunded: true,
      isCountSettled: true,
      isValueSettled: false,
      expectedSettlementCount: "2",
      settlementCount: "2",
      remainingSettlementCount: "0",
      fundingAmount: "1000",
      settledAmount: "800",
      remainingFundingAmount: "200"
    });

    assert.match(output, /Batch Reconciliation Report/);
    assert.match(output, /batchId: 12/);
    assert.match(output, /isFunded: true/);
    assert.match(output, /isCountSettled: true/);
    assert.match(output, /isValueSettled: false/);
    assert.match(output, /remainingFundingAmount: 200/);
  });

  it("serializes a reconciliation report as pretty JSON", function () {
    const output = serializeBatchReconciliation({
      batchId: "3",
      isFunded: true,
      isCountSettled: false,
      isValueSettled: false,
      expectedSettlementCount: "2",
      settlementCount: "1",
      remainingSettlementCount: "1",
      fundingAmount: "1000",
      settledAmount: "400",
      remainingFundingAmount: "600"
    });

    assert.match(output, /"batchId": "3"/);
    assert.match(output, /"remainingFundingAmount": "600"/);
  });

  it("resolves json output mode from cli flags or environment", function () {
    const fromFlag = resolveOptions(["--json"], {});
    const fromEnv = resolveOptions([], { REPORT_OUTPUT: "json" });

    assert.equal(fromFlag.output, "json");
    assert.equal(fromEnv.output, "json");
    assert.equal(fromFlag.batchId, 1n);
    assert.equal(fromEnv.batchId, 1n);
  });

  it("builds a discord webhook payload from a reconciliation report", function () {
    const payload = buildDiscordWebhookPayload({
      batchId: "21",
      isFunded: true,
      isCountSettled: true,
      isValueSettled: false,
      expectedSettlementCount: "2",
      settlementCount: "2",
      remainingSettlementCount: "0",
      fundingAmount: "1000",
      settledAmount: "800",
      remainingFundingAmount: "200"
    });

    assert.equal(payload.username, "Payroll Reconciliation Bot");
    assert.equal(payload.embeds.length, 1);
    assert.equal(payload.embeds[0].title, "Batch Reconciliation #21");
    assert.equal(payload.embeds[0].color, 16098851);
    assert.match(payload.embeds[0].description, /Count settled: true/);
    assert.equal(payload.embeds[0].fields[0].name, "Settlement Progress");
    assert.match(payload.embeds[0].fields[1].value, /fundingAmount: 1000/);
  });

  it("resolves discord output mode from cli flags or environment", function () {
    const fromFlag = resolveOptions(["--discord"], {});
    const fromEnv = resolveOptions([], { REPORT_OUTPUT: "discord" });

    assert.equal(fromFlag.output, "discord");
    assert.equal(fromEnv.output, "discord");
  });
});
