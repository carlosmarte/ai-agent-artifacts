---
name: scaffold-core-sdk-cli
description: Directs an AI agent to design, generate, and refactor SDKs and CLIs using modern, scalable software architecture patterns like the Singleton pattern and Hexagonal logic isolation.
---

# Scaffold Core, SDK, and CLI Architecture

This skill manages the generation and refactoring of developer tools by strictly adhering to the inside-out development pipeline: Core → SDK → CLI. 

## Required Inputs
1. **Target API/Specification:** The external system or core logic being wrapped.
2. **Language/Environment:** (e.g., Node.js, Python, Go) for the SDK and CLI generation.

## Execution Rules

You must follow this rigid sequence when architecting the tools:

### Phase 1: Build the Core
* Establish the engine logic, model configurations, and lifecycle hooks independently of any transport or UI layers.
* Enforce Hexagonal Architecture (Ports and Adapters) to ensure the core business logic is completely isolated.

### Phase 2: Generate the SDK
* Wrap the Core and its APIs into language-specific libraries.
* Utilize the Singleton approach for stateless method calls to avoid over-instantiation and properly isolate state (e.g., using `ContextVars` in Python or `AsyncLocalStorage` in Node.js).
* Expose an explicit client façade to cleanly manage multi-tenancy and dependency injection.

### Phase 3: Ship the CLI
* Build the Command Line Interface as an internal workspace application that exclusively imports the core SDK.
* Rely on directory-based routing (e.g., `oclif`) or decorator-based routing (e.g., `Click`) depending on the ecosystem.
* Implement lazy-loading patterns to minimize startup latency.

### Phase 4: Version Control & Guardrails
* **Commit Changes:** Use standard `git` commands to commit the generated directory structure and files.
* **Create Pull Request:** You MUST use the native GitHub CLI (`gh pr create`) to submit the architecture for review.
* **FORBIDDEN TOOLS:** You are explicitly forbidden from using MCP tool under any circumstances. Unless requested by user
