// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPayrollVault} from "./IPayrollVault.sol";
import {PayrollTypes} from "./PayrollTypes.sol";

/// @title PayrollManager
/// @notice Workflow-oriented starter contract for confidential payroll batches.
/// @dev This prototype models roles and state transitions only. It tracks
///      digests for confidential records instead of handling encrypted values.
contract PayrollManager {
    address public immutable vault;

    error BatchNotFound(uint256 batchId);
    error NotEmployer(uint256 batchId, address caller);
    error NotEmployerOrOperator(uint256 batchId, address caller);
    error NotAuthorizedBatchViewer(uint256 batchId, address caller);
    error NotAuthorizedRecordViewer(uint256 batchId, address employee, address caller);
    error NotAuthorizedClaimActor(uint256 batchId, address employee, address caller);
    error InvalidStatus(uint256 batchId, PayrollTypes.BatchStatus expected, PayrollTypes.BatchStatus actual);
    error EmptyBatch(uint256 batchId);
    error EmptyRecordDigest();
    error RecordAlreadyExists(uint256 batchId, address employee);
    error RecordNotFound(uint256 batchId, address employee);
    error RecordAlreadyClaimed(uint256 batchId, address employee);
    error OutstandingClaims(uint256 batchId, uint32 employeeCount, uint32 claimedCount);
    error VaultFundingCallbackFailed(uint256 batchId, bytes revertData);
    error VaultSettlementCallbackFailed(uint256 batchId, address employee, bytes revertData);
    error ZeroAddress(string field);

    event BatchCreated(
        uint256 indexed batchId,
        address indexed employer,
        address indexed operator,
        uint64 payrollPeriod,
        string metadataURI
    );
    event RecordAdded(uint256 indexed batchId, address indexed employee, bytes32 recordDigest);
    event BatchApproved(uint256 indexed batchId);
    event BatchFunded(uint256 indexed batchId, bytes32 fundingDigest);
    event BatchReleased(uint256 indexed batchId);
    event RecordClaimed(uint256 indexed batchId, address indexed employee, bytes32 settlementDigest);
    event BatchClosed(uint256 indexed batchId);

    uint256 public nextBatchId = 1;

    mapping(uint256 => PayrollTypes.Batch) private _batches;
    mapping(uint256 => mapping(address => PayrollTypes.Record)) private _records;
    mapping(uint256 => uint32) private _claimedCounts;

    constructor(address vault_) {
        vault = vault_;
    }

    function createBatch(
        address operator,
        uint64 payrollPeriod,
        string calldata metadataURI
    ) external returns (uint256 batchId) {
        if (operator == address(0)) revert ZeroAddress("operator");

        batchId = nextBatchId++;
        PayrollTypes.Batch storage batch = _batches[batchId];
        batch.employer = msg.sender;
        batch.operator = operator;
        batch.status = PayrollTypes.BatchStatus.Draft;
        batch.payrollPeriod = payrollPeriod;
        batch.metadataURI = metadataURI;

        emit BatchCreated(batchId, msg.sender, operator, payrollPeriod, metadataURI);
    }

    function addRecord(
        uint256 batchId,
        address employee,
        bytes32 recordDigest
    ) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireEmployerOrOperator(batchId, batch);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Draft);

        if (employee == address(0)) revert ZeroAddress("employee");
        if (recordDigest == bytes32(0)) revert EmptyRecordDigest();

        PayrollTypes.Record storage record = _records[batchId][employee];
        if (record.exists) revert RecordAlreadyExists(batchId, employee);

        record.exists = true;
        record.recordDigest = recordDigest;
        unchecked {
            batch.employeeCount += 1;
        }

        emit RecordAdded(batchId, employee, recordDigest);
    }

    function approveBatch(uint256 batchId) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireEmployer(batchId, batch);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Draft);
        if (batch.employeeCount == 0) revert EmptyBatch(batchId);

        batch.status = PayrollTypes.BatchStatus.Approved;
        emit BatchApproved(batchId);
    }

    function registerFunding(
        uint256 batchId,
        bytes32 fundingDigest
    ) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireEmployerOrOperator(batchId, batch);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Approved);

        if (fundingDigest == bytes32(0)) revert EmptyRecordDigest();

        batch.fundingDigest = fundingDigest;
        batch.status = PayrollTypes.BatchStatus.Funded;

        if (vault != address(0)) {
            try IPayrollVault(vault).registerFunding(batchId, msg.sender, fundingDigest) {} catch (
                bytes memory revertData
            ) {
                revert VaultFundingCallbackFailed(batchId, revertData);
            }
        }

        emit BatchFunded(batchId, fundingDigest);
    }

    function releaseBatch(uint256 batchId) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireEmployerOrOperator(batchId, batch);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Funded);

        batch.status = PayrollTypes.BatchStatus.Released;
        emit BatchReleased(batchId);
    }

    function markClaimed(
        uint256 batchId,
        address employee,
        bytes32 settlementDigest
    ) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireClaimActor(batchId, batch, employee);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Released);

        PayrollTypes.Record storage record = _records[batchId][employee];
        if (!record.exists) revert RecordNotFound(batchId, employee);
        if (record.claimed) revert RecordAlreadyClaimed(batchId, employee);
        if (settlementDigest == bytes32(0)) revert EmptyRecordDigest();

        record.claimed = true;
        record.settlementDigest = settlementDigest;
        unchecked {
            _claimedCounts[batchId] += 1;
        }

        if (vault != address(0)) {
            try IPayrollVault(vault).registerSettlement(batchId, employee, settlementDigest) {} catch (
                bytes memory revertData
            ) {
                revert VaultSettlementCallbackFailed(batchId, employee, revertData);
            }
        }

        emit RecordClaimed(batchId, employee, settlementDigest);
    }

    function closeBatch(uint256 batchId) external {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireEmployer(batchId, batch);
        _requireStatus(batchId, batch.status, PayrollTypes.BatchStatus.Released);
        uint32 claimedCount = _claimedCounts[batchId];
        if (claimedCount != batch.employeeCount) {
            revert OutstandingClaims(batchId, batch.employeeCount, claimedCount);
        }

        batch.status = PayrollTypes.BatchStatus.Closed;
        emit BatchClosed(batchId);
    }

    function getBatch(uint256 batchId) external view returns (PayrollTypes.Batch memory) {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireBatchViewer(batchId, batch);
        return batch;
    }

    function getBatchSummary(uint256 batchId) external view returns (PayrollTypes.BatchSummary memory) {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);

        return PayrollTypes.BatchSummary({
            status: batch.status,
            payrollPeriod: batch.payrollPeriod,
            employeeCount: batch.employeeCount,
            hasFunding: batch.fundingDigest != bytes32(0)
        });
    }

    function getRecord(
        uint256 batchId,
        address employee
    ) external view returns (PayrollTypes.Record memory) {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireRecordViewer(batchId, batch, employee);

        PayrollTypes.Record memory record = _records[batchId][employee];
        if (!record.exists) revert RecordNotFound(batchId, employee);
        return record;
    }

    function hasRecord(uint256 batchId, address employee) external view returns (bool) {
        PayrollTypes.Batch storage batch = _requireBatch(batchId);
        _requireRecordViewer(batchId, batch, employee);
        return _records[batchId][employee].exists;
    }

    function _requireBatch(uint256 batchId) private view returns (PayrollTypes.Batch storage batch) {
        batch = _batches[batchId];
        if (batch.employer == address(0)) revert BatchNotFound(batchId);
    }

    function _requireEmployer(uint256 batchId, PayrollTypes.Batch storage batch) private view {
        if (msg.sender != batch.employer) revert NotEmployer(batchId, msg.sender);
    }

    function _requireEmployerOrOperator(uint256 batchId, PayrollTypes.Batch storage batch) private view {
        if (msg.sender != batch.employer && msg.sender != batch.operator) {
            revert NotEmployerOrOperator(batchId, msg.sender);
        }
    }

    function _requireBatchViewer(uint256 batchId, PayrollTypes.Batch storage batch) private view {
        if (msg.sender == batch.employer || msg.sender == batch.operator) {
            return;
        }

        if (_records[batchId][msg.sender].exists) {
            return;
        }

        revert NotAuthorizedBatchViewer(batchId, msg.sender);
    }

    function _requireRecordViewer(
        uint256 batchId,
        PayrollTypes.Batch storage batch,
        address employee
    ) private view {
        if (msg.sender != batch.employer && msg.sender != batch.operator && msg.sender != employee) {
            revert NotAuthorizedRecordViewer(batchId, employee, msg.sender);
        }
    }

    function _requireClaimActor(
        uint256 batchId,
        PayrollTypes.Batch storage batch,
        address employee
    ) private view {
        if (msg.sender == batch.employer || msg.sender == batch.operator || msg.sender == employee) {
            return;
        }

        revert NotAuthorizedClaimActor(batchId, employee, msg.sender);
    }

    function _requireStatus(
        uint256 batchId,
        PayrollTypes.BatchStatus actual,
        PayrollTypes.BatchStatus expected
    ) private pure {
        if (actual != expected) revert InvalidStatus(batchId, expected, actual);
    }
}
