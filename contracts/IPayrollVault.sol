// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPayrollVault
/// @notice Future settlement layer for the confidential payroll starter.
/// @dev This interface intentionally avoids concrete token mechanics. The
///      current starter models workflow first and leaves settlement for later.
interface IPayrollVault {
    function registerFunding(
        uint256 batchId,
        address payer,
        bytes32 fundingDigest
    ) external;

    function registerSettlement(
        uint256 batchId,
        address employee,
        bytes32 settlementDigest
    ) external;
}
