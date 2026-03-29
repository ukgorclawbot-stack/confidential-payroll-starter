// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PayrollTypes
/// @notice Shared types for the confidential payroll starter prototype.
library PayrollTypes {
    enum BatchStatus {
        Draft,
        Approved,
        Funded,
        Released,
        Closed
    }

    struct Batch {
        address employer;
        address operator;
        BatchStatus status;
        uint64 payrollPeriod;
        uint32 employeeCount;
        string metadataURI;
        bytes32 fundingDigest;
    }

    struct BatchSummary {
        BatchStatus status;
        uint64 payrollPeriod;
        uint32 employeeCount;
        bool hasFunding;
    }

    /// @notice Stores an opaque reference to confidential payroll data.
    /// @dev The prototype tracks only digests so workflow can be modeled
    ///      without pretending confidential values are handled onchain yet.
    struct Record {
        bool exists;
        bool claimed;
        bytes32 recordDigest;
        bytes32 settlementDigest;
    }
}
