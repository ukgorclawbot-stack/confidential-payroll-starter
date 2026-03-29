const assert = require("node:assert/strict");
const { ethers } = require("hardhat");

describe("PayrollManager", function () {
  function getEventArgs(receipt, contract, eventName) {
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === eventName) {
          return parsed.args;
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }

    throw new Error(`Missing event: ${eventName}`);
  }

  async function deployFixture() {
    const [employer, operator, employeeA, employeeB, outsider] = await ethers.getSigners();
    const PayrollManager = await ethers.getContractFactory("PayrollManager");
    const payrollManager = await PayrollManager.connect(employer).deploy(ethers.ZeroAddress);
    await payrollManager.waitForDeployment();

    return { payrollManager, employer, operator, employeeA, employeeB, outsider };
  }

  async function deployVaultFixture() {
    const [employer, operator, employeeA, employeeB, outsider] = await ethers.getSigners();
    const MockPayrollVault = await ethers.getContractFactory("MockPayrollVault");
    const mockVault = await MockPayrollVault.connect(employer).deploy();
    await mockVault.waitForDeployment();

    const PayrollManager = await ethers.getContractFactory("PayrollManager");
    const payrollManager = await PayrollManager.connect(employer).deploy(await mockVault.getAddress());
    await payrollManager.waitForDeployment();

    return {
      payrollManager,
      mockVault,
      employer,
      operator,
      employeeA,
      employeeB,
      outsider
    };
  }

  async function createApprovedBatch(payrollManager, employer, operator, employeeA) {
    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-helper")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-helper"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
  }

  async function createReleasedBatch(payrollManager, employer, operator, employeeA) {
    await createApprovedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-helper"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
  }

  async function createClosedBatch(payrollManager, employer, operator, employeeA) {
    await createReleasedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-helper"))).wait();
    await (await payrollManager.connect(employer).closeBatch(1)).wait();
  }

  it("rejects approving an empty batch", async function () {
    const { payrollManager, employer, operator } = await deployFixture();

    const tx = await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-1");
    await tx.wait();

    await assert.rejects(
      payrollManager.connect(employer).approveBatch(1),
      /reverted/
    );
  });

  it("rejects creating a batch with a zero operator", async function () {
    const { payrollManager, employer } = await deployFixture();

    await assert.rejects(
      payrollManager
        .connect(employer)
        .createBatch(ethers.ZeroAddress, 202601, "ipfs://batch-zero-operator"),
      /ZeroAddress/
    );
  });

  it("emits BatchCreated with the expected metadata", async function () {
    const { payrollManager, employer, operator } = await deployFixture();

    const tx = await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-event-1");
    const receipt = await tx.wait();
    const args = getEventArgs(receipt, payrollManager, "BatchCreated");

    assert.equal(args.batchId, 1n);
    assert.equal(args.employer, employer.address);
    assert.equal(args.operator, operator.address);
    assert.equal(args.payrollPeriod, 202601n);
    assert.equal(args.metadataURI, "ipfs://batch-event-1");
  });

  it("emits RecordAdded with the employee and record digest", async function () {
    const { payrollManager, employer, operator, employeeA } = await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-event-record")).wait();

    const recordDigest = ethers.id("record-event-a");
    const tx = await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, recordDigest);
    const receipt = await tx.wait();
    const args = getEventArgs(receipt, payrollManager, "RecordAdded");

    assert.equal(args.batchId, 1n);
    assert.equal(args.employee, employeeA.address);
    assert.equal(args.recordDigest, recordDigest);
  });

  it("emits BatchApproved for a non-empty batch", async function () {
    const { payrollManager, employer, operator, employeeA } = await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-event-approve")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-approve-a"))).wait();

    const tx = await payrollManager.connect(employer).approveBatch(1);
    const receipt = await tx.wait();
    const args = getEventArgs(receipt, payrollManager, "BatchApproved");

    assert.equal(args.batchId, 1n);
  });

  it("rejects closing a released batch before all claims are settled", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-2")).wait();

    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeB.address, ethers.id("record-b"))).wait();

    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();

    await assert.rejects(
      payrollManager.connect(employer).closeBatch(1),
      /reverted/
    );
  });

  it("allows closing after every record has been claimed", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-3")).wait();

    await (await payrollManager
      .connect(employer)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeB.address, ethers.id("record-b"))).wait();

    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();
    await (await payrollManager
      .connect(operator)
      .markClaimed(1, employeeB.address, ethers.id("settlement-b"))).wait();
    await (await payrollManager.connect(employer).closeBatch(1)).wait();

    const batch = await payrollManager.getBatch(1);
    assert.equal(batch.status, 4n);
  });

  it("rejects reading batch details from an unrelated address", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-3b")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await assert.rejects(
      payrollManager.connect(outsider).getBatch(1),
      /NotAuthorizedBatchViewer/
    );
  });

  it("allows a batch participant to read batch details", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-3c")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    const employerBatch = await payrollManager.connect(employer).getBatch(1);
    const operatorBatch = await payrollManager.connect(operator).getBatch(1);
    const employeeBatch = await payrollManager.connect(employeeA).getBatch(1);

    assert.equal(employerBatch.status, 0n);
    assert.equal(operatorBatch.status, 0n);
    assert.equal(employeeBatch.status, 0n);
    assert.equal(employeeBatch.employeeCount, 1n);
  });

  it("allows an unrelated address to read the public batch summary", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-3d")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    const summary = await payrollManager.connect(outsider).getBatchSummary(1);

    assert.equal(summary.status, 0n);
    assert.equal(summary.payrollPeriod, 202601n);
    assert.equal(summary.employeeCount, 1n);
    assert.equal(summary.claimedCount, 0n);
    assert.equal(summary.remainingClaims, 1n);
    assert.equal(summary.hasFunding, false);
    assert.equal(summary.isClosable, false);
  });

  it("updates the public batch summary as workflow state changes", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);

    const approvedSummary = await payrollManager
      .connect(outsider)
      .getBatchSummary(1);
    assert.equal(approvedSummary.status, 1n);
    assert.equal(approvedSummary.claimedCount, 0n);
    assert.equal(approvedSummary.remainingClaims, 1n);
    assert.equal(approvedSummary.hasFunding, false);
    assert.equal(approvedSummary.isClosable, false);

    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-summary"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-summary"))).wait();

    const releasedSummary = await payrollManager
      .connect(outsider)
      .getBatchSummary(1);
    assert.equal(releasedSummary.status, 3n);
    assert.equal(releasedSummary.claimedCount, 1n);
    assert.equal(releasedSummary.remainingClaims, 0n);
    assert.equal(releasedSummary.hasFunding, true);
    assert.equal(releasedSummary.employeeCount, 1n);
    assert.equal(releasedSummary.isClosable, true);

    await (await payrollManager.connect(employer).closeBatch(1)).wait();

    const closedSummary = await payrollManager
      .connect(outsider)
      .getBatchSummary(1);
    assert.equal(closedSummary.status, 4n);
    assert.equal(closedSummary.claimedCount, 1n);
    assert.equal(closedSummary.remainingClaims, 0n);
    assert.equal(closedSummary.isClosable, false);
  });

  it("keeps the public batch summary non-closable while claims remain", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-summary-partial")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-summary-a"))).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeB.address, ethers.id("record-summary-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-summary-partial"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-summary-a"))).wait();

    const summary = await payrollManager.connect(outsider).getBatchSummary(1);

    assert.equal(summary.status, 3n);
    assert.equal(summary.employeeCount, 2n);
    assert.equal(summary.claimedCount, 1n);
    assert.equal(summary.remainingClaims, 1n);
    assert.equal(summary.isClosable, false);
  });

  it("rejects reading a payroll record from an unrelated address", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-4")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await assert.rejects(
      payrollManager.connect(outsider).getRecord(1, employeeA.address),
      /reverted/
    );
  });

  it("rejects checking record existence from an unrelated address", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-4b")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await assert.rejects(
      payrollManager.connect(outsider).hasRecord(1, employeeA.address),
      /reverted/
    );
  });

  it("allows authorized viewers to check record existence", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-4c")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    assert.equal(
      await payrollManager.connect(employeeA).hasRecord(1, employeeA.address),
      true
    );
    assert.equal(
      await payrollManager.connect(operator).hasRecord(1, employeeA.address),
      true
    );
  });

  it("allows an employee to self-claim after release", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-5")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();

    const record = await payrollManager
      .connect(employeeA)
      .getRecord(1, employeeA.address);
    assert.equal(record.claimed, true);
  });

  it("rejects an employee claiming another employee's record", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-5b")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await assert.rejects(
      payrollManager
        .connect(employeeA)
        .markClaimed(1, employeeB.address, ethers.id("settlement-b")),
      /reverted/
    );
  });

  it("rejects adding a record from an unrelated address", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-6")).wait();

    await assert.rejects(
      payrollManager
        .connect(outsider)
        .addRecord(1, employeeA.address, ethers.id("record-a")),
      /reverted/
    );
  });

  it("rejects adding a record with a zero employee", async function () {
    const { payrollManager, employer, operator } = await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-zero-employee")).wait();

    await assert.rejects(
      payrollManager
        .connect(operator)
        .addRecord(1, ethers.ZeroAddress, ethers.id("record-zero-employee")),
      /ZeroAddress/
    );
  });

  it("rejects adding a record with an empty digest", async function () {
    const { payrollManager, employer, operator, employeeA } = await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-empty-record-digest")).wait();

    await assert.rejects(
      payrollManager
        .connect(operator)
        .addRecord(1, employeeA.address, ethers.ZeroHash),
      /EmptyRecordDigest/
    );
  });

  it("rejects approving a batch from a non-employer address", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-7")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await assert.rejects(
      payrollManager.connect(operator).approveBatch(1),
      /reverted/
    );
  });

  it("rejects registering funding before approval", async function () {
    const { payrollManager, employer, operator } = await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-8")).wait();

    await assert.rejects(
      payrollManager.connect(operator).registerFunding(1, ethers.id("funding-a")),
      /reverted/
    );
  });

  it("rejects registering funding with an empty digest", async function () {
    const { payrollManager, employer, operator, employeeA } = await deployFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager.connect(operator).registerFunding(1, ethers.ZeroHash),
      /EmptyRecordDigest/
    );
  });

  it("rejects releasing a batch before funding", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager.connect(operator).releaseBatch(1),
      /reverted/
    );
  });

  it("emits BatchFunded and BatchReleased during a successful release flow", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);

    const fundingDigest = ethers.id("funding-event");
    const fundingTx = await payrollManager
      .connect(operator)
      .registerFunding(1, fundingDigest);
    const fundingReceipt = await fundingTx.wait();
    const fundingArgs = getEventArgs(fundingReceipt, payrollManager, "BatchFunded");

    assert.equal(fundingArgs.batchId, 1n);
    assert.equal(fundingArgs.fundingDigest, fundingDigest);

    const releaseTx = await payrollManager.connect(operator).releaseBatch(1);
    const releaseReceipt = await releaseTx.wait();
    const releaseArgs = getEventArgs(releaseReceipt, payrollManager, "BatchReleased");

    assert.equal(releaseArgs.batchId, 1n);
  });

  it("rejects releasing the same batch twice", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager.connect(operator).releaseBatch(1),
      /InvalidStatus/
    );
  });

  it("rejects claiming the same record twice", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();

    await assert.rejects(
      payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-b")),
      /reverted/
    );
  });

  it("rejects claiming with an empty settlement digest", async function () {
    const { payrollManager, employer, operator, employeeA } = await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager
        .connect(employeeA)
        .markClaimed(1, employeeA.address, ethers.ZeroHash),
      /EmptyRecordDigest/
    );
  });

  it("rejects reading a summary for a missing batch", async function () {
    const { payrollManager, outsider } = await deployFixture();

    await assert.rejects(
      payrollManager.connect(outsider).getBatchSummary(999),
      /BatchNotFound/
    );
  });

  it("registers funding with the configured vault", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);

    const fundingDigest = ethers.id("funding-vault");
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, fundingDigest)).wait();

    assert.equal(await mockVault.lastFundingBatchId(), 1n);
    assert.equal(await mockVault.lastFundingPayer(), operator.address);
    assert.equal(await mockVault.lastFundingDigest(), fundingDigest);
    assert.equal(await mockVault.fundingCalls(), 1n);
  });

  it("rejects registering funding twice for the same batch", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    const firstFundingDigest = ethers.id("funding-first");
    const secondFundingDigest = ethers.id("funding-second");

    await createApprovedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, firstFundingDigest)).wait();

    await assert.rejects(
      payrollManager
        .connect(operator)
        .registerFunding(1, secondFundingDigest),
      /InvalidStatus/
    );

    const batch = await payrollManager.getBatch(1);
    assert.equal(batch.status, 2n);
    assert.equal(batch.fundingDigest, firstFundingDigest);
    assert.equal(await mockVault.fundingCalls(), 1n);
    assert.equal(await mockVault.lastFundingDigest(), firstFundingDigest);
  });

  it("rejects registering funding after the batch has been released", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    const fundingDigest = ethers.id("funding-released");

    await createApprovedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, fundingDigest)).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await assert.rejects(
      payrollManager
        .connect(operator)
        .registerFunding(1, ethers.id("funding-too-late")),
      /InvalidStatus/
    );

    const batch = await payrollManager.getBatch(1);
    assert.equal(batch.status, 3n);
    assert.equal(batch.fundingDigest, fundingDigest);
    assert.equal(await mockVault.fundingCalls(), 1n);
  });

  it("registers settlement with the configured vault", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    const settlementDigest = ethers.id("settlement-vault");
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, settlementDigest)).wait();

    assert.equal(await mockVault.lastSettlementBatchId(), 1n);
    assert.equal(await mockVault.lastSettlementEmployee(), employeeA.address);
    assert.equal(await mockVault.lastSettlementDigest(), settlementDigest);
    assert.equal(await mockVault.settlementCalls(), 1n);
  });

  it("emits RecordClaimed with the employee and settlement digest", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    const settlementDigest = ethers.id("settlement-event");
    const tx = await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, settlementDigest);
    const receipt = await tx.wait();
    const args = getEventArgs(receipt, payrollManager, "RecordClaimed");

    assert.equal(args.batchId, 1n);
    assert.equal(args.employee, employeeA.address);
    assert.equal(args.settlementDigest, settlementDigest);
  });

  it("preserves funding callback history across multiple batches", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA, employeeB } =
      await deployVaultFixture();

    const fundingDigestA = ethers.id("funding-vault-a");
    const fundingDigestB = ethers.id("funding-vault-b");

    await createApprovedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, fundingDigestA)).wait();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202602, "ipfs://batch-12")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(2, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(2)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(2, fundingDigestB)).wait();

    const fundingCallA = await mockVault.getFundingCall(0);
    const fundingCallB = await mockVault.getFundingCall(1);

    assert.equal(await mockVault.fundingCalls(), 2n);
    assert.equal(fundingCallA.batchId, 1n);
    assert.equal(fundingCallA.payer, operator.address);
    assert.equal(fundingCallA.fundingDigest, fundingDigestA);
    assert.equal(fundingCallB.batchId, 2n);
    assert.equal(fundingCallB.payer, operator.address);
    assert.equal(fundingCallB.fundingDigest, fundingDigestB);
  });

  it("preserves settlement callback history across multiple claims", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA, employeeB } =
      await deployVaultFixture();

    const settlementDigestA = ethers.id("settlement-vault-a");
    const settlementDigestB = ethers.id("settlement-vault-b");

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-13")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, settlementDigestA)).wait();
    await (await payrollManager
      .connect(employeeB)
      .markClaimed(1, employeeB.address, settlementDigestB)).wait();

    const settlementCallA = await mockVault.getSettlementCall(0);
    const settlementCallB = await mockVault.getSettlementCall(1);

    assert.equal(await mockVault.settlementCalls(), 2n);
    assert.equal(settlementCallA.batchId, 1n);
    assert.equal(settlementCallA.employee, employeeA.address);
    assert.equal(settlementCallA.settlementDigest, settlementDigestA);
    assert.equal(settlementCallB.batchId, 1n);
    assert.equal(settlementCallB.employee, employeeB.address);
    assert.equal(settlementCallB.settlementDigest, settlementDigestB);
  });

  it("reverts funding registration when the vault rejects the callback", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    await createApprovedBatch(payrollManager, employer, operator, employeeA);
    await (await mockVault.setRejectFunding(true)).wait();

    await assert.rejects(
      payrollManager
        .connect(operator)
        .registerFunding(1, ethers.id("funding-rejected")),
      /VaultFundingCallbackFailed/
    );

    const batch = await payrollManager.getBatch(1);
    assert.equal(batch.status, 1n);
    assert.equal(batch.fundingDigest, ethers.ZeroHash);
    assert.equal(await mockVault.fundingCalls(), 0n);
  });

  it("reverts claim registration when the vault rejects the callback", async function () {
    const { payrollManager, mockVault, employer, operator, employeeA } =
      await deployVaultFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);
    await (await mockVault.setRejectSettlement(true)).wait();

    await assert.rejects(
      payrollManager
        .connect(employeeA)
        .markClaimed(1, employeeA.address, ethers.id("settlement-rejected")),
      /VaultSettlementCallbackFailed/
    );

    const record = await payrollManager
      .connect(employeeA)
      .getRecord(1, employeeA.address);
    assert.equal(record.claimed, false);
    assert.equal(record.settlementDigest, ethers.ZeroHash);
    assert.equal(await mockVault.settlementCalls(), 0n);
  });

  it("rejects adding a record after the batch is closed", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB } =
      await deployFixture();

    await createClosedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager
        .connect(operator)
        .addRecord(1, employeeB.address, ethers.id("late-record")),
      /reverted/
    );
  });

  it("rejects registering funding after the batch is closed", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createClosedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager
        .connect(operator)
        .registerFunding(1, ethers.id("late-funding")),
      /reverted/
    );
  });

  it("rejects releasing a batch after it is closed", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createClosedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager.connect(operator).releaseBatch(1),
      /reverted/
    );
  });

  it("rejects marking a claim after the batch is closed", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createClosedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager
        .connect(employeeA)
        .markClaimed(1, employeeA.address, ethers.id("late-settlement")),
      /reverted/
    );
  });

  it("rejects closing a batch from non-employer callers", async function () {
    const { payrollManager, employer, operator, employeeA, outsider } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();

    await assert.rejects(
      payrollManager.connect(operator).closeBatch(1),
      /NotEmployer/
    );
    await assert.rejects(
      payrollManager.connect(outsider).closeBatch(1),
      /NotEmployer/
    );
  });

  it("keeps employee claim state isolated across multiple batches", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-14")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a-1"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202602, "ipfs://batch-15")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(2, employeeA.address, ethers.id("record-a-2"))).wait();
    await (await payrollManager.connect(employer).approveBatch(2)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(2, ethers.id("funding-2"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(2)).wait();

    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-1"))).wait();

    const batchOneRecord = await payrollManager
      .connect(employeeA)
      .getRecord(1, employeeA.address);
    const batchTwoRecord = await payrollManager
      .connect(employeeA)
      .getRecord(2, employeeA.address);

    assert.equal(batchOneRecord.claimed, true);
    assert.equal(batchOneRecord.settlementDigest, ethers.id("settlement-1"));
    assert.equal(batchTwoRecord.claimed, false);
    assert.equal(batchTwoRecord.settlementDigest, ethers.ZeroHash);
  });

  it("allows closing one settled batch while another batch remains unsettled", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-16")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-1"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(1)).wait();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202602, "ipfs://batch-17")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(2, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(2)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(2, ethers.id("funding-2"))).wait();
    await (await payrollManager.connect(operator).releaseBatch(2)).wait();

    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-a"))).wait();

    await (await payrollManager.connect(employer).closeBatch(1)).wait();

    const closedBatch = await payrollManager.getBatch(1);
    const openBatch = await payrollManager.getBatch(2);

    assert.equal(closedBatch.status, 4n);
    assert.equal(openBatch.status, 3n);

    await assert.rejects(
      payrollManager.connect(employer).closeBatch(2),
      /OutstandingClaims/
    );
  });

  it("rejects funding a batch from another batch's operator", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-18")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();

    await (await payrollManager
      .connect(employer)
      .createBatch(outsider.address, 202602, "ipfs://batch-19")).wait();
    await (await payrollManager
      .connect(outsider)
      .addRecord(2, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(2)).wait();

    await assert.rejects(
      payrollManager.connect(outsider).registerFunding(1, ethers.id("funding-a")),
      /NotEmployerOrOperator/
    );
    await assert.rejects(
      payrollManager.connect(operator).registerFunding(2, ethers.id("funding-b")),
      /NotEmployerOrOperator/
    );

    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-a"))).wait();
    await (await payrollManager
      .connect(outsider)
      .registerFunding(2, ethers.id("funding-b"))).wait();

    const batchOne = await payrollManager.getBatch(1);
    const batchTwo = await payrollManager.getBatch(2);

    assert.equal(batchOne.status, 2n);
    assert.equal(batchTwo.status, 2n);
  });

  it("rejects releasing a batch from another batch's operator", async function () {
    const { payrollManager, employer, operator, employeeA, employeeB, outsider } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-20")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager
      .connect(operator)
      .registerFunding(1, ethers.id("funding-a"))).wait();

    await (await payrollManager
      .connect(employer)
      .createBatch(outsider.address, 202602, "ipfs://batch-21")).wait();
    await (await payrollManager
      .connect(outsider)
      .addRecord(2, employeeB.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(employer).approveBatch(2)).wait();
    await (await payrollManager
      .connect(outsider)
      .registerFunding(2, ethers.id("funding-b"))).wait();

    await assert.rejects(
      payrollManager.connect(outsider).releaseBatch(1),
      /NotEmployerOrOperator/
    );
    await assert.rejects(
      payrollManager.connect(operator).releaseBatch(2),
      /NotEmployerOrOperator/
    );

    await (await payrollManager.connect(operator).releaseBatch(1)).wait();
    await (await payrollManager.connect(outsider).releaseBatch(2)).wait();

    const batchOne = await payrollManager.getBatch(1);
    const batchTwo = await payrollManager.getBatch(2);

    assert.equal(batchOne.status, 3n);
    assert.equal(batchTwo.status, 3n);
  });

  it("rejects approving a batch from another batch's employer", async function () {
    const { payrollManager, employer, operator, employeeA, outsider, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-22")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-23")).wait();
    await (await payrollManager
      .connect(employeeB)
      .addRecord(2, employeeA.address, ethers.id("record-b"))).wait();

    await assert.rejects(
      payrollManager.connect(outsider).approveBatch(1),
      /NotEmployer/
    );
    await assert.rejects(
      payrollManager.connect(employer).approveBatch(2),
      /NotEmployer/
    );

    await (await payrollManager.connect(employer).approveBatch(1)).wait();
    await (await payrollManager.connect(outsider).approveBatch(2)).wait();

    const batchOne = await payrollManager.connect(employer).getBatch(1);
    const batchTwo = await payrollManager.connect(outsider).getBatch(2);
    assert.equal(batchOne.status, 1n);
    assert.equal(batchTwo.status, 1n);
  });

  it("rejects approving a batch from another batch's operator", async function () {
    const { payrollManager, employer, operator, employeeA, outsider, employeeB } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-24")).wait();
    await (await payrollManager
      .connect(operator)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-25")).wait();
    await (await payrollManager
      .connect(employeeB)
      .addRecord(2, employeeA.address, ethers.id("record-b"))).wait();

    await assert.rejects(
      payrollManager.connect(employeeB).approveBatch(1),
      /NotEmployer/
    );
    await assert.rejects(
      payrollManager.connect(operator).approveBatch(2),
      /NotEmployer/
    );
  });

  it("rejects adding a record from another batch's employer", async function () {
    const { payrollManager, employer, operator, outsider, employeeB, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-26")).wait();

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-27")).wait();

    await assert.rejects(
      payrollManager.connect(outsider).addRecord(1, employeeA.address, ethers.id("record-a")),
      /NotEmployerOrOperator/
    );
    await assert.rejects(
      payrollManager.connect(employer).addRecord(2, employeeA.address, ethers.id("record-b")),
      /NotEmployerOrOperator/
    );

    await (await payrollManager
      .connect(employer)
      .addRecord(1, employeeA.address, ethers.id("record-a"))).wait();
    await (await payrollManager
      .connect(outsider)
      .addRecord(2, employeeA.address, ethers.id("record-b"))).wait();
  });

  it("rejects adding a record from another batch's operator", async function () {
    const { payrollManager, employer, operator, outsider, employeeB, employeeA } =
      await deployFixture();

    await (await payrollManager
      .connect(employer)
      .createBatch(operator.address, 202601, "ipfs://batch-28")).wait();

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-29")).wait();

    await assert.rejects(
      payrollManager.connect(employeeB).addRecord(1, employeeA.address, ethers.id("record-a")),
      /NotEmployerOrOperator/
    );
    await assert.rejects(
      payrollManager.connect(operator).addRecord(2, employeeA.address, ethers.id("record-b")),
      /NotEmployerOrOperator/
    );
  });

  it("rejects claiming a batch from another batch's employer", async function () {
    const { payrollManager, employer, operator, outsider, employeeB, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-30")).wait();
    await (await payrollManager
      .connect(employeeB)
      .addRecord(2, employeeA.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(outsider).approveBatch(2)).wait();
    await (await payrollManager
      .connect(employeeB)
      .registerFunding(2, ethers.id("funding-b"))).wait();
    await (await payrollManager.connect(employeeB).releaseBatch(2)).wait();

    await assert.rejects(
      payrollManager
        .connect(outsider)
        .markClaimed(1, employeeA.address, ethers.id("settlement-a")),
      /NotAuthorizedClaimActor/
    );
    await assert.rejects(
      payrollManager
        .connect(employer)
        .markClaimed(2, employeeA.address, ethers.id("settlement-b")),
      /NotAuthorizedClaimActor/
    );
  });

  it("rejects claiming a batch from another batch's operator", async function () {
    const { payrollManager, employer, operator, outsider, employeeB, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);

    await (await payrollManager
      .connect(outsider)
      .createBatch(employeeB.address, 202602, "ipfs://batch-31")).wait();
    await (await payrollManager
      .connect(employeeB)
      .addRecord(2, employeeA.address, ethers.id("record-b"))).wait();
    await (await payrollManager.connect(outsider).approveBatch(2)).wait();
    await (await payrollManager
      .connect(employeeB)
      .registerFunding(2, ethers.id("funding-b"))).wait();
    await (await payrollManager.connect(employeeB).releaseBatch(2)).wait();

    await assert.rejects(
      payrollManager
        .connect(employeeB)
        .markClaimed(1, employeeA.address, ethers.id("settlement-a")),
      /NotAuthorizedClaimActor/
    );
    await assert.rejects(
      payrollManager
        .connect(operator)
        .markClaimed(2, employeeA.address, ethers.id("settlement-b")),
      /NotAuthorizedClaimActor/
    );
  });

  it("rejects closing a batch twice", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createClosedBatch(payrollManager, employer, operator, employeeA);

    await assert.rejects(
      payrollManager.connect(employer).closeBatch(1),
      /reverted/
    );
  });

  it("emits BatchClosed when the employer closes a settled batch", async function () {
    const { payrollManager, employer, operator, employeeA } =
      await deployFixture();

    await createReleasedBatch(payrollManager, employer, operator, employeeA);
    await (await payrollManager
      .connect(employeeA)
      .markClaimed(1, employeeA.address, ethers.id("settlement-close"))).wait();

    const tx = await payrollManager.connect(employer).closeBatch(1);
    const receipt = await tx.wait();
    const args = getEventArgs(receipt, payrollManager, "BatchClosed");

    assert.equal(args.batchId, 1n);
  });
});

describe("MockPayrollVault", function () {
  function getVaultEventArgs(receipt, contract, eventName) {
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === eventName) {
          return parsed.args;
        }
      } catch {
        // Ignore logs from other contracts.
      }
    }

    throw new Error(`Missing vault event: ${eventName}`);
  }

  async function deployMockVaultFixture() {
    const [caller, employee] = await ethers.getSigners();
    const MockPayrollVault = await ethers.getContractFactory("MockPayrollVault");
    const mockVault = await MockPayrollVault.connect(caller).deploy();
    await mockVault.waitForDeployment();

    return { mockVault, caller, employee };
  }

  it("tracks per-batch funding and settlement state", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();

    const fundingDigest = ethers.id("vault-funding-state");
    const settlementDigest = ethers.id("vault-settlement-state");

    await (await mockVault
      .connect(caller)
      .registerFunding(7, caller.address, fundingDigest)).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(7, employee.address, settlementDigest)).wait();

    assert.equal(await mockVault.isBatchFunded(7), true);
    assert.equal(await mockVault.getFundingDigest(7), fundingDigest);
    assert.equal(await mockVault.isSettlementRecorded(7, employee.address), true);
    assert.equal(
      await mockVault.getSettlementDigest(7, employee.address),
      settlementDigest
    );
  });

  it("rejects overwriting funding state for the same batch", async function () {
    const { mockVault, caller } = await deployMockVaultFixture();

    await (await mockVault
      .connect(caller)
      .registerFunding(8, caller.address, ethers.id("vault-funding-a"))).wait();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerFunding(8, caller.address, ethers.id("vault-funding-b")),
      /BatchAlreadyFunded/
    );
  });

  it("rejects settlement before funding and duplicate settlement records", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerSettlement(9, employee.address, ethers.id("vault-settlement-a")),
      /BatchNotFunded/
    );

    await (await mockVault
      .connect(caller)
      .registerFunding(9, caller.address, ethers.id("vault-funding-a"))).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(9, employee.address, ethers.id("vault-settlement-a"))).wait();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerSettlement(9, employee.address, ethers.id("vault-settlement-b")),
      /SettlementAlreadyRecorded/
    );
  });

  it("emits funding and settlement events with per-batch settlement counts", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();

    const fundingDigest = ethers.id("vault-funding-event");
    const settlementDigest = ethers.id("vault-settlement-event");

    const fundingTx = await mockVault
      .connect(caller)
      .registerFunding(10, caller.address, fundingDigest);
    const fundingReceipt = await fundingTx.wait();
    const fundingArgs = getVaultEventArgs(fundingReceipt, mockVault, "FundingRegistered");

    assert.equal(fundingArgs.batchId, 10n);
    assert.equal(fundingArgs.payer, caller.address);
    assert.equal(fundingArgs.fundingDigest, fundingDigest);

    const settlementTx = await mockVault
      .connect(caller)
      .registerSettlement(10, employee.address, settlementDigest);
    const settlementReceipt = await settlementTx.wait();
    const settlementArgs = getVaultEventArgs(
      settlementReceipt,
      mockVault,
      "SettlementRegistered"
    );

    assert.equal(settlementArgs.batchId, 10n);
    assert.equal(settlementArgs.employee, employee.address);
    assert.equal(settlementArgs.settlementDigest, settlementDigest);
    assert.equal(settlementArgs.settlementCount, 1n);
    assert.equal(await mockVault.getSettlementCount(10), 1n);
  });

  it("keeps settlement counts isolated per batch", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();
    const [, , secondEmployee] = await ethers.getSigners();

    await (await mockVault
      .connect(caller)
      .registerFunding(11, caller.address, ethers.id("vault-funding-11"))).wait();
    await (await mockVault
      .connect(caller)
      .registerFunding(12, caller.address, ethers.id("vault-funding-12"))).wait();

    await (await mockVault
      .connect(caller)
      .registerSettlement(11, employee.address, ethers.id("vault-settlement-11a"))).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(11, secondEmployee.address, ethers.id("vault-settlement-11b"))).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(12, employee.address, ethers.id("vault-settlement-12a"))).wait();

    assert.equal(await mockVault.getSettlementCount(11), 2n);
    assert.equal(await mockVault.getSettlementCount(12), 1n);
  });

  it("rejects configuring expected settlements before funding or with a zero target", async function () {
    const { mockVault, caller } = await deployMockVaultFixture();

    await assert.rejects(
      mockVault.connect(caller).setExpectedSettlementCount(13, 1),
      /BatchNotFunded/
    );

    await (await mockVault
      .connect(caller)
      .registerFunding(13, caller.address, ethers.id("vault-funding-13"))).wait();

    await assert.rejects(
      mockVault.connect(caller).setExpectedSettlementCount(13, 0),
      /InvalidExpectedSettlementCount/
    );
  });

  it("tracks remaining settlements and marks the batch settled at the expected count", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();
    const [, , secondEmployee] = await ethers.getSigners();

    await (await mockVault
      .connect(caller)
      .registerFunding(14, caller.address, ethers.id("vault-funding-14"))).wait();

    const configureTx = await mockVault.connect(caller).setExpectedSettlementCount(14, 2);
    const configureReceipt = await configureTx.wait();
    const configureArgs = getVaultEventArgs(
      configureReceipt,
      mockVault,
      "ExpectedSettlementCountConfigured"
    );

    assert.equal(configureArgs.batchId, 14n);
    assert.equal(configureArgs.expectedSettlementCount, 2n);
    assert.equal(await mockVault.getExpectedSettlementCount(14), 2n);
    assert.equal(await mockVault.getRemainingSettlementCount(14), 2n);
    assert.equal(await mockVault.isBatchSettled(14), false);

    await (await mockVault
      .connect(caller)
      .registerSettlement(14, employee.address, ethers.id("vault-settlement-14a"))).wait();

    assert.equal(await mockVault.getRemainingSettlementCount(14), 1n);
    assert.equal(await mockVault.isBatchSettled(14), false);

    const settleTx = await mockVault
      .connect(caller)
      .registerSettlement(14, secondEmployee.address, ethers.id("vault-settlement-14b"));
    const settleReceipt = await settleTx.wait();
    const settleArgs = getVaultEventArgs(settleReceipt, mockVault, "BatchSettled");

    assert.equal(settleArgs.batchId, 14n);
    assert.equal(settleArgs.settlementCount, 2n);
    assert.equal(await mockVault.getRemainingSettlementCount(14), 0n);
    assert.equal(await mockVault.isBatchSettled(14), true);
  });

  it("rejects further settlements after the batch is marked settled", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();
    const [, , secondEmployee] = await ethers.getSigners();

    await (await mockVault
      .connect(caller)
      .registerFunding(15, caller.address, ethers.id("vault-funding-15"))).wait();
    await (await mockVault.connect(caller).setExpectedSettlementCount(15, 1)).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(15, employee.address, ethers.id("vault-settlement-15a"))).wait();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerSettlement(15, secondEmployee.address, ethers.id("vault-settlement-15b")),
      /BatchAlreadySettled/
    );
  });

  it("rejects configuring a funding amount before funding or with invalid values", async function () {
    const { mockVault, caller } = await deployMockVaultFixture();

    await assert.rejects(
      mockVault.connect(caller).setFundingAmount(16, 1_000),
      /BatchNotFunded/
    );

    await (await mockVault
      .connect(caller)
      .registerFunding(16, caller.address, ethers.id("vault-funding-16"))).wait();

    await assert.rejects(
      mockVault.connect(caller).setFundingAmount(16, 0),
      /InvalidFundingAmount/
    );

    await (await mockVault.connect(caller).setFundingAmount(16, 1_000)).wait();

    assert.equal(await mockVault.getFundingAmount(16), 1_000n);
    assert.equal(await mockVault.getSettledAmount(16), 0n);
    assert.equal(await mockVault.getRemainingFundingAmount(16), 1_000n);
    assert.equal(await mockVault.isBatchValueSettled(16), false);

    await assert.rejects(
      mockVault.connect(caller).setFundingAmount(16, 2_000),
      /FundingAmountAlreadyConfigured/
    );
  });

  it("rejects settlement registration without a configured settlement amount when value accounting is enabled", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();

    await (await mockVault
      .connect(caller)
      .registerFunding(17, caller.address, ethers.id("vault-funding-17"))).wait();
    await (await mockVault.connect(caller).setFundingAmount(17, 500)).wait();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerSettlement(17, employee.address, ethers.id("vault-settlement-17a")),
      /SettlementAmountNotConfigured/
    );
  });

  it("applies configured settlement amounts and marks the batch value-settled when fully allocated", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();
    const [, , secondEmployee] = await ethers.getSigners();

    const settlementDigestA = ethers.id("vault-settlement-18a");
    const settlementDigestB = ethers.id("vault-settlement-18b");

    await (await mockVault
      .connect(caller)
      .registerFunding(18, caller.address, ethers.id("vault-funding-18"))).wait();
    await (await mockVault.connect(caller).setFundingAmount(18, 1_000)).wait();
    await (await mockVault.connect(caller).setSettlementAmount(settlementDigestA, 400)).wait();
    await (await mockVault.connect(caller).setSettlementAmount(settlementDigestB, 600)).wait();

    const firstSettlementTx = await mockVault
      .connect(caller)
      .registerSettlement(18, employee.address, settlementDigestA);
    const firstSettlementReceipt = await firstSettlementTx.wait();
    const firstValueArgs = getVaultEventArgs(
      firstSettlementReceipt,
      mockVault,
      "SettlementValueApplied"
    );

    assert.equal(firstValueArgs.batchId, 18n);
    assert.equal(firstValueArgs.employee, employee.address);
    assert.equal(firstValueArgs.settlementAmount, 400n);
    assert.equal(firstValueArgs.totalSettledAmount, 400n);
    assert.equal(await mockVault.getSettledAmount(18), 400n);
    assert.equal(await mockVault.getRemainingFundingAmount(18), 600n);
    assert.equal(await mockVault.isBatchValueSettled(18), false);

    const secondSettlementTx = await mockVault
      .connect(caller)
      .registerSettlement(18, secondEmployee.address, settlementDigestB);
    const secondSettlementReceipt = await secondSettlementTx.wait();
    const valueSettledArgs = getVaultEventArgs(
      secondSettlementReceipt,
      mockVault,
      "BatchValueSettled"
    );

    assert.equal(valueSettledArgs.batchId, 18n);
    assert.equal(valueSettledArgs.settledAmount, 1_000n);
    assert.equal(await mockVault.getSettledAmount(18), 1_000n);
    assert.equal(await mockVault.getRemainingFundingAmount(18), 0n);
    assert.equal(await mockVault.isBatchValueSettled(18), true);
  });

  it("rejects settlements that exceed the configured funding amount", async function () {
    const { mockVault, caller, employee } = await deployMockVaultFixture();
    const [, , secondEmployee] = await ethers.getSigners();

    const settlementDigestA = ethers.id("vault-settlement-19a");
    const settlementDigestB = ethers.id("vault-settlement-19b");

    await (await mockVault
      .connect(caller)
      .registerFunding(19, caller.address, ethers.id("vault-funding-19"))).wait();
    await (await mockVault.connect(caller).setFundingAmount(19, 500)).wait();
    await (await mockVault.connect(caller).setSettlementAmount(settlementDigestA, 400)).wait();
    await (await mockVault.connect(caller).setSettlementAmount(settlementDigestB, 200)).wait();
    await (await mockVault
      .connect(caller)
      .registerSettlement(19, employee.address, settlementDigestA)).wait();

    await assert.rejects(
      mockVault
        .connect(caller)
        .registerSettlement(19, secondEmployee.address, settlementDigestB),
      /SettlementExceedsFundingAmount/
    );
  });
});
