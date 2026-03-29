// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPayrollVault} from "./IPayrollVault.sol";

/// @title MockPayrollVault
/// @notice Minimal vault stub used by the local Hardhat tests.
contract MockPayrollVault is IPayrollVault {
    struct FundingCall {
        uint256 batchId;
        address payer;
        bytes32 fundingDigest;
    }

    struct SettlementCall {
        uint256 batchId;
        address employee;
        bytes32 settlementDigest;
    }

    error BatchAlreadyFunded(uint256 batchId);
    error BatchNotFunded(uint256 batchId);
    error BatchAlreadySettled(uint256 batchId);
    error InvalidFundingAmount(uint256 batchId, uint256 fundingAmount);
    error FundingAmountAlreadyConfigured(uint256 batchId);
    error InvalidExpectedSettlementCount(uint256 batchId, uint256 expectedSettlementCount);
    error ExpectedSettlementCountAlreadyConfigured(uint256 batchId);
    error InvalidSettlementAmount(bytes32 settlementDigest, uint256 settlementAmount);
    error SettlementAmountAlreadyConfigured(bytes32 settlementDigest);
    error SettlementAmountNotConfigured(bytes32 settlementDigest);
    error SettlementExceedsFundingAmount(uint256 batchId, uint256 fundingAmount, uint256 attemptedSettledAmount);
    error SettlementAlreadyRecorded(uint256 batchId, address employee);

    event FundingRegistered(uint256 indexed batchId, address indexed payer, bytes32 fundingDigest);
    event FundingAmountConfigured(uint256 indexed batchId, uint256 fundingAmount);
    event ExpectedSettlementCountConfigured(uint256 indexed batchId, uint256 expectedSettlementCount);
    event SettlementAmountConfigured(bytes32 indexed settlementDigest, uint256 settlementAmount);
    event SettlementRegistered(
        uint256 indexed batchId,
        address indexed employee,
        bytes32 settlementDigest,
        uint256 settlementCount
    );
    event SettlementValueApplied(
        uint256 indexed batchId,
        address indexed employee,
        uint256 settlementAmount,
        uint256 totalSettledAmount
    );
    event BatchSettled(uint256 indexed batchId, uint256 settlementCount);
    event BatchValueSettled(uint256 indexed batchId, uint256 settledAmount);

    uint256 public fundingCalls;
    uint256 public settlementCalls;
    bool public rejectFunding;
    bool public rejectSettlement;

    uint256 public lastFundingBatchId;
    address public lastFundingPayer;
    bytes32 public lastFundingDigest;

    uint256 public lastSettlementBatchId;
    address public lastSettlementEmployee;
    bytes32 public lastSettlementDigest;

    FundingCall[] private _fundingHistory;
    SettlementCall[] private _settlementHistory;
    mapping(uint256 => bool) private _batchFunded;
    mapping(uint256 => bool) private _batchSettled;
    mapping(uint256 => bytes32) private _fundingDigests;
    mapping(uint256 => uint256) private _fundingAmounts;
    mapping(uint256 => bool) private _expectedSettlementConfigured;
    mapping(uint256 => uint256) private _expectedSettlementCounts;
    mapping(uint256 => uint256) private _settlementCounts;
    mapping(uint256 => uint256) private _settledAmounts;
    mapping(bytes32 => bool) private _settlementAmountConfigured;
    mapping(bytes32 => uint256) private _settlementAmounts;
    mapping(uint256 => mapping(address => bool)) private _settlementRecorded;
    mapping(uint256 => mapping(address => bytes32)) private _settlementDigests;

    function setRejectFunding(bool shouldReject) external {
        rejectFunding = shouldReject;
    }

    function setRejectSettlement(bool shouldReject) external {
        rejectSettlement = shouldReject;
    }

    function registerFunding(
        uint256 batchId,
        address payer,
        bytes32 fundingDigest
    ) external override {
        require(!rejectFunding, "MockPayrollVault: funding rejected");
        if (_batchFunded[batchId]) revert BatchAlreadyFunded(batchId);

        fundingCalls += 1;
        lastFundingBatchId = batchId;
        lastFundingPayer = payer;
        lastFundingDigest = fundingDigest;
        _batchFunded[batchId] = true;
        _fundingDigests[batchId] = fundingDigest;
        _fundingHistory.push(FundingCall({
            batchId: batchId,
            payer: payer,
            fundingDigest: fundingDigest
        }));

        emit FundingRegistered(batchId, payer, fundingDigest);
    }

    function registerSettlement(
        uint256 batchId,
        address employee,
        bytes32 settlementDigest
    ) external override {
        require(!rejectSettlement, "MockPayrollVault: settlement rejected");
        if (!_batchFunded[batchId]) revert BatchNotFunded(batchId);
        if (_batchSettled[batchId]) revert BatchAlreadySettled(batchId);
        if (_settlementRecorded[batchId][employee]) {
            revert SettlementAlreadyRecorded(batchId, employee);
        }

        uint256 settlementAmount;
        if (_fundingAmounts[batchId] != 0) {
            if (!_settlementAmountConfigured[settlementDigest]) {
                revert SettlementAmountNotConfigured(settlementDigest);
            }

            settlementAmount = _settlementAmounts[settlementDigest];
            uint256 attemptedSettledAmount = _settledAmounts[batchId] + settlementAmount;
            if (attemptedSettledAmount > _fundingAmounts[batchId]) {
                revert SettlementExceedsFundingAmount(
                    batchId,
                    _fundingAmounts[batchId],
                    attemptedSettledAmount
                );
            }

            _settledAmounts[batchId] = attemptedSettledAmount;
        }

        settlementCalls += 1;
        lastSettlementBatchId = batchId;
        lastSettlementEmployee = employee;
        lastSettlementDigest = settlementDigest;
        _settlementCounts[batchId] += 1;
        _settlementRecorded[batchId][employee] = true;
        _settlementDigests[batchId][employee] = settlementDigest;
        _settlementHistory.push(SettlementCall({
            batchId: batchId,
            employee: employee,
            settlementDigest: settlementDigest
        }));

        emit SettlementRegistered(batchId, employee, settlementDigest, _settlementCounts[batchId]);

        if (settlementAmount != 0) {
            emit SettlementValueApplied(batchId, employee, settlementAmount, _settledAmounts[batchId]);
        }

        if (
            _expectedSettlementConfigured[batchId] &&
            _settlementCounts[batchId] == _expectedSettlementCounts[batchId]
        ) {
            _batchSettled[batchId] = true;
            emit BatchSettled(batchId, _settlementCounts[batchId]);
        }

        if (_fundingAmounts[batchId] != 0 && _settledAmounts[batchId] == _fundingAmounts[batchId]) {
            emit BatchValueSettled(batchId, _settledAmounts[batchId]);
        }
    }

    function setExpectedSettlementCount(uint256 batchId, uint256 expectedSettlementCount) external {
        if (!_batchFunded[batchId]) revert BatchNotFunded(batchId);
        if (expectedSettlementCount == 0) {
            revert InvalidExpectedSettlementCount(batchId, expectedSettlementCount);
        }
        if (_expectedSettlementConfigured[batchId]) {
            revert ExpectedSettlementCountAlreadyConfigured(batchId);
        }

        _expectedSettlementConfigured[batchId] = true;
        _expectedSettlementCounts[batchId] = expectedSettlementCount;

        emit ExpectedSettlementCountConfigured(batchId, expectedSettlementCount);
    }

    function setFundingAmount(uint256 batchId, uint256 fundingAmount) external {
        if (!_batchFunded[batchId]) revert BatchNotFunded(batchId);
        if (fundingAmount == 0) revert InvalidFundingAmount(batchId, fundingAmount);
        if (_fundingAmounts[batchId] != 0) revert FundingAmountAlreadyConfigured(batchId);

        _fundingAmounts[batchId] = fundingAmount;

        emit FundingAmountConfigured(batchId, fundingAmount);
    }

    function setSettlementAmount(bytes32 settlementDigest, uint256 settlementAmount) external {
        if (settlementAmount == 0) {
            revert InvalidSettlementAmount(settlementDigest, settlementAmount);
        }
        if (_settlementAmountConfigured[settlementDigest]) {
            revert SettlementAmountAlreadyConfigured(settlementDigest);
        }

        _settlementAmountConfigured[settlementDigest] = true;
        _settlementAmounts[settlementDigest] = settlementAmount;

        emit SettlementAmountConfigured(settlementDigest, settlementAmount);
    }

    function getFundingCall(
        uint256 index
    ) external view returns (uint256 batchId, address payer, bytes32 fundingDigest) {
        FundingCall storage callData = _fundingHistory[index];
        return (callData.batchId, callData.payer, callData.fundingDigest);
    }

    function getSettlementCall(
        uint256 index
    ) external view returns (uint256 batchId, address employee, bytes32 settlementDigest) {
        SettlementCall storage callData = _settlementHistory[index];
        return (callData.batchId, callData.employee, callData.settlementDigest);
    }

    function isBatchFunded(uint256 batchId) external view returns (bool) {
        return _batchFunded[batchId];
    }

    function getFundingDigest(uint256 batchId) external view returns (bytes32) {
        return _fundingDigests[batchId];
    }

    function getFundingAmount(uint256 batchId) external view returns (uint256) {
        return _fundingAmounts[batchId];
    }

    function isBatchSettled(uint256 batchId) external view returns (bool) {
        return _batchSettled[batchId];
    }

    function isBatchValueSettled(uint256 batchId) external view returns (bool) {
        return _fundingAmounts[batchId] != 0 && _settledAmounts[batchId] == _fundingAmounts[batchId];
    }

    function getExpectedSettlementCount(uint256 batchId) external view returns (uint256) {
        return _expectedSettlementCounts[batchId];
    }

    function getRemainingSettlementCount(uint256 batchId) external view returns (uint256) {
        uint256 expectedSettlementCount = _expectedSettlementCounts[batchId];
        uint256 settlementCount = _settlementCounts[batchId];

        if (expectedSettlementCount <= settlementCount) {
            return 0;
        }

        return expectedSettlementCount - settlementCount;
    }

    function getSettledAmount(uint256 batchId) external view returns (uint256) {
        return _settledAmounts[batchId];
    }

    function getRemainingFundingAmount(uint256 batchId) external view returns (uint256) {
        uint256 fundingAmount = _fundingAmounts[batchId];
        uint256 settledAmount = _settledAmounts[batchId];

        if (fundingAmount <= settledAmount) {
            return 0;
        }

        return fundingAmount - settledAmount;
    }

    function isSettlementRecorded(uint256 batchId, address employee) external view returns (bool) {
        return _settlementRecorded[batchId][employee];
    }

    function getSettlementDigest(uint256 batchId, address employee) external view returns (bytes32) {
        return _settlementDigests[batchId][employee];
    }

    function getSettlementCount(uint256 batchId) external view returns (uint256) {
        return _settlementCounts[batchId];
    }
}
