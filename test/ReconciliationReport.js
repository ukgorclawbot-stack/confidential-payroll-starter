const assert = require("node:assert/strict");

const {
  normalizeBatchReconciliation,
  formatBatchReconciliation,
  serializeBatchReconciliation,
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
});
