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
    error SettlementAlreadyRecorded(uint256 batchId, address employee);

    event FundingRegistered(uint256 indexed batchId, address indexed payer, bytes32 fundingDigest);
    event SettlementRegistered(
        uint256 indexed batchId,
        address indexed employee,
        bytes32 settlementDigest,
        uint256 settlementCount
    );

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
    mapping(uint256 => bytes32) private _fundingDigests;
    mapping(uint256 => uint256) private _settlementCounts;
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
        if (_settlementRecorded[batchId][employee]) {
            revert SettlementAlreadyRecorded(batchId, employee);
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
