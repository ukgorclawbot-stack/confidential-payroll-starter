const assert = require("node:assert/strict");

const {
  normalizeBatchReconciliation,
  formatBatchReconciliation
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
});
