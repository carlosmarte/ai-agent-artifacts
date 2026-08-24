---
name: create-agent-skill
description: Formalizes a workflow, resolution, or pattern into a reusable Agent Skill artifact adhering strictly to the agentskills.io specification, utilizing progressive disclosure and native version control.
compatibility: Requires bash, git, and the gh CLI.
---

# Agent Skill Creator

You are tasked with generating a new, standardized Agent Skill. This skill captures procedural logic so workflows can be autonomously executed in the future.

## Phase 1: Input Collection & Analysis
Before generating the skill, ensure you have the required context from the user. If missing, ask for:
* **Context:** What was being done when the issue surfaced or the workflow was executed?
* **Finding:** What went wrong, what was missed, or what was the core objective?
* **Resolution/Execution Steps:** How was it fixed or corrected?

Analyze the workflow to extract the generic pattern, structural root cause, or core operational capability, ignoring highly specific incident details.

## Phase 2: Name Suggestion & User Confirmation (CRITICAL HALT)
1. Generate a highly descriptive, `kebab-case` name based on the analysis (e.g., `validate-package-exports`). 
2. **Halt execution:** Present the suggested name to the user and prompt them to either confirm the suggestion or provide their preferred `{{skill-name}}`.
3. Do not proceed to artifact generation until the user has explicitly confirmed the name.

## Phase 3: Directory Scaffolding & Artifact Generation
Agent skills must be contained within a dedicated directory matching the confirmed `{{skill-name}}`. Scaffold the following structure:
* `skill-name/SKILL.md` (Required: metadata + instructions)
* `skill-name/scripts/` (Optional: executable code to keep the main file lean)
* `skill-name/references/` (Optional: detailed documentation for progressive disclosure)

### Frontmatter Formatting
The `SKILL.md` file MUST begin with strict YAML frontmatter.
* `name`: Max 64 characters. Unicode lowercase alphanumeric (`a-z`, `0-9`) and hyphens only. Must match the parent directory name. No consecutive hyphens.
* `description`: Max 1024 characters. Explicitly state *what* the skill does and *when* the agent should invoke it. Include specific keywords.

### Body Content & Progressive Disclosure
Structure the Markdown body to isolate procedural "how-to" logic from declarative knowledge.
* Keep the main `SKILL.md` under 500 lines. 
* Utilize **Progressive Disclosure**: Move dense lookup tables, schemas, or complex configurations to the `references/` or `assets/` directories and reference them via relative paths (e.g., `See [the reference guide](references/REFERENCE.md)`).
* Apply **Explicit Cognitive Phasing**: break instructions down into conceptual mapping, execution steps, and validation.

## Phase 4: Output Analysis
Following the fenced code block, you must append a structured 3-part analysis (1. The Concept, 2. Execution, 3. Review) evaluating the newly created skill.

## Phase 5: Version Control Guardrails
When committing the new skill to the repository, you must adhere to strict security protocols:
* **ALLOWED:** Use standard bash commands and the official GitHub CLI (`gh pr create`, `gh issue create`).
* **FORBIDDEN:** You must never use the `github-create_pull_request` MCP tool or any other untethered connector abstractions.
