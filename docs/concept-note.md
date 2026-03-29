# Concept Note: Confidential Payroll Starter Pack

## Summary

This project explores how confidential payroll can be designed on top of Zama.

The core idea is simple:

Payroll execution should be possible onchain, but employee compensation details should not be publicly exposed.

This starter pack is not a full payroll product. It is an early builder contribution intended to help developers think clearly about one of the most practical real-world use cases for confidential blockchain applications.

## Problem statement

Traditional onchain applications are transparent by default.

That is useful in many settings, but payroll has different requirements. If salary information, bonus structure, reimbursement amounts, or contractor payments are fully visible, a company may expose sensitive internal information such as:

- employee compensation
- internal role structure
- team hierarchy
- treasury behavior
- vendor and contractor relationships

For most organizations, that level of transparency is not acceptable.

As a result, payroll is usually kept fully offchain, even though onchain systems could improve coordination, auditability, and automation.

This creates a gap between what blockchain can coordinate and what real businesses can actually use.

## Why this use case matters

Confidential payroll is a strong test case for confidential blockchain infrastructure.

If a system can support payroll with meaningful privacy guarantees while preserving onchain execution and operational visibility, then it becomes easier to imagine many other confidential business workflows, including:

- bonuses
- contractor invoices
- reimbursements
- treasury-controlled disbursements
- department budget flows
- selective compliance reporting

Payroll is therefore not just a narrow HR tool. It is a gateway use case for real-world confidential applications.

## Why Zama

Zama enables builders to design applications where sensitive values can remain protected while computation and coordination still happen onchain.

That makes Zama especially relevant for workflows where public execution is useful, but public values are harmful.

Payroll fits that pattern well.

A confidential payroll application on Zama could allow:

- employers to create payroll batches
- employees to receive or claim confidential payments
- operators to manage payroll execution
- authorized reviewers to access only the minimum necessary information

This creates a better balance between privacy, programmability, and operational trust.

## Project goals

This starter pack has four goals:

1. Clarify why confidential payroll is a meaningful onchain use case
2. Define a minimum architecture that builders can understand quickly
3. Provide a simple example flow that can be extended into code
4. Lower the barrier for future builders who want to experiment with Zama in business-facing applications

## Scope

This project focuses on the minimum useful version of the problem.

Included scope:

- concept definition
- actor model
- privacy boundaries
- payroll batch lifecycle
- builder-oriented documentation
- starter implementation direction

Excluded scope for now:

- tax reporting
- legal employment rules
- fiat payout integration
- enterprise HR systems
- production-grade compliance workflows

The purpose of this version is clarity, not completeness.

## Intended audience

This starter pack is designed for:

- developers exploring Zama use cases
- builders looking for real-world application patterns
- contributors interested in confidential business workflows
- ecosystem teams who want a simple example to discuss and extend

## Proposed output

The project is structured as a documentation-first starter repository.

Outputs include:

- a concept note
- a builder-friendly tutorial
- an architecture overview
- a sample payroll flow
- placeholders for contracts and scripts

Later versions may include:

- a minimal prototype
- local test flows
- contract interfaces
- access control examples
- encrypted record handling patterns

## Why this contribution is useful

Many technical ecosystems attract early experimentation, but adoption improves when practical use cases are clearly documented.

This contribution is useful because it focuses on a concrete and understandable problem. It turns confidential computation from an abstract concept into a workflow that developers can reason about immediately.

Instead of asking "what can I build with confidential blockchain," this project answers with a more helpful question:

"What would it take to build confidential payroll in a way that is understandable, extensible, and worth prototyping?"

## Success criteria

This starter pack will be successful if it helps a new builder quickly understand:

- why payroll privacy matters
- why Zama is relevant
- what the minimum system should include
- what a first implementation could look like
- how this pattern could expand into other confidential finance workflows

## Long-term direction

This repository can evolve in several directions:

- minimal smart contract prototype
- reusable payroll batch template
- confidential bonus distribution example
- contractor payout example
- selective audit access model
- integration with confidential treasury workflows

## Closing note

Confidential payroll is one of the clearest examples of why confidential blockchain applications matter.

This project is an attempt to make that idea concrete, practical, and easier for other builders to explore on Zama.
