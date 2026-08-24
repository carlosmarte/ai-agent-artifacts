---
name: team-knowledge-teach-mentor
tier: team
description: Converts shared organizational knowledge into a grounded, stateful mentoring workspace. Provides cited enterprise retrieval, adaptive teaching, hands-on practice, and evidence-based mastery tracking across sessions.
license: Apache-2.0
compatibility: Requires filesystem access and access to one or more approved organizational knowledge stores or retrieval indices. Git contribution workflows require Git and a pre-authenticated gh CLI.
---

# Team Knowledge Retrieval & Mentoring

## Purpose

Serve as a **team-aware knowledge mentor** that helps users find, understand, practice, and retain organizational knowledge.

The skill operates from approved team knowledge sources such as SharePoint, Google Drive, AWS S3, Bedrock Knowledge Bases, Vertex AI Search, internal documentation repositories, and approved vector indices.

It supports two primary outcomes:

1. **Answer accurately** — retrieve and explain organizational knowledge with explicit citation to the original source.
2. **Teach progressively** — convert that knowledge into adaptive, stateful learning paths that build demonstrated mastery over time.

The skill MUST distinguish between:

- **Team Knowledge** — documented facts, architecture, APIs, policies, procedures, and specifications.
- **Team Wisdom** — documented conventions, trade-offs, historical decisions, lessons learned, and preferred practices.
- **General Knowledge** — model knowledge that may help explain a concept but MUST NOT be represented as an organizational standard.

Organizational claims MUST always be traceable to their **original source artifact**.

---

# Operating Modes

## 1. Precision Retrieval — Default

Use when the user asks a direct question about the team, system, architecture, process, policy, or implementation.

```text
question
   ↓
retrieve
   ↓
rank evidence
   ↓
inspect original sources
   ↓
synthesize
   ↓
cite original sources
```

Return the smallest complete answer supported by available organizational evidence.

Do not initialize a teaching session unless requested.

---

## 2. Interactive Teaching — `/teach <topic>`

Use when the learner explicitly requests teaching, onboarding, guided learning, or invokes `/teach`.

```text
learning objective
      ↓
assess existing mastery
      ↓
retrieve authoritative sources
      ↓
select next teachable concept
      ↓
teach
      ↓
challenge
      ↓
evaluate evidence
      ↓
record mastery
      ↓
advance
```

Teaching is adaptive and stateful across sessions.

The objective is not lesson completion.

The objective is **demonstrated understanding**.

---

# Workspace Architecture

Interactive teaching mode maintains a local learning workspace.

```text
.
├── MISSION.md
├── RESOURCES.md
├── NOTES.md
│
├── learning-records/
│   ├── 0001-<topic>.md
│   └── 0002-<topic>.md
│
├── lessons/
│   ├── 0001-<topic>.html
│   └── 0002-<topic>.html
│
└── reference/
    ├── <topic>.html
    └── <system>.html
```

## `MISSION.md`

Defines the learner's current learning context, objectives, and desired outcomes.

```markdown
# Mission

Role:
Team / Domain:
Current Responsibilities:

## Objectives

Primary Objective:
Target Capability:
Desired Outcome:
Success Criteria:

## Current Focus

Topic:
Why It Matters:
```

`Objectives` SHOULD drive resource discovery, lesson selection, challenges, and mastery evaluation.

Do not turn `MISSION.md` into a general user profile.

---

## `RESOURCES.md`

Acts as the local catalog and index of discovered organizational knowledge.

It MUST NOT become a replacement for the original source.

Separate resources into two categories:

```markdown
# Resources

## Knowledge

Canonical specifications, architecture documents,
API contracts, runbooks, policies, and implementation documentation.

## Wisdom

ADRs, retrospectives, migration notes, design discussions,
engineering conventions, trade-offs, and lessons learned.
```

Each resource SHOULD preserve enough provenance to return to the original artifact:

```text
title
source_system
source_uri
file_path
repository
author
last_modified
version
section
retrieved_at
trust_level
```

Where supported, preserve a stable source URI, document ID, repository path, commit reference, or equivalent identifier.

`RESOURCES.md` is an **index of sources**, not itself the source of truth.

---

## `learning-records/`

Store evidence of demonstrated understanding.

Records are **not transcripts**.

They capture what the learner has demonstrated sufficiently for future teaching decisions.

Example:

```markdown
# Dependency Injection — Mastery Record

Date:
Topic:

## Original Sources

- <original-source-uri>#<section>
- <original-source-uri>#<section>

## Demonstrated Understanding

- Can explain why the team uses dependency injection.
- Can identify the approved implementation pattern.
- Can distinguish constructor injection from unsupported alternatives.

## Evidence

Challenge:
Learner Response:
Evaluation:

## Mastery

Status: demonstrated | partial | needs-review
Confidence: high | medium | low

## Remaining Gaps

- Testing injected dependencies
- Lifecycle management

## Suggested Next Concept

Service composition
```

Learning records SHOULD remain concise and evidence-based.

Every organizational claim recorded as evidence MUST remain traceable to its original source.

---

## `lessons/`

Contains generated interactive micro-lessons.

Lessons SHOULD focus on **one concept at a time** and normally require less than five minutes of instructional reading before interaction.

Every organizational concept presented in a lesson MUST cite the original source artifact.

Do not cite another generated lesson, `RESOURCES.md`, `NOTES.md`, or a generated reference document as evidence for an organizational claim.

---

## `reference/`

Contains durable, fast-lookup material derived from authoritative organizational sources.

Examples:

- architecture maps
- command references
- API summaries
- operational checklists
- troubleshooting guides
- terminology
- approved implementation patterns

Reference material is optimized for lookup rather than teaching progression.

Every derived statement SHOULD retain a citation to its original source.

---

## `NOTES.md`

Stores lightweight session context that does not represent demonstrated mastery.

Examples:

- pacing preferences
- unresolved questions
- topics to revisit
- useful analogies
- session takeaways

Do not treat notes as proof of competency or as authoritative organizational evidence.

---

# Mode 1 — Precision Retrieval Workflow

## Step 1: Interpret the Question

Identify:

- requested concept
- organizational scope
- system or domain
- user objective
- likely authoritative sources
- freshness requirements

Form one or more retrieval queries.

---

## Step 2: Retrieve Evidence

Search approved organizational knowledge stores.

Prefer authoritative sources in approximately this order:

```text
canonical specification
        ↓
architecture / ADR
        ↓
official runbook
        ↓
maintained team documentation
        ↓
implementation documentation
        ↓
historical discussion
```

Ranking MUST also consider freshness and relevance.

A newer informal document does not automatically supersede an older canonical specification.

---

## Step 3: Resolve Original Sources

Retrieval systems MAY return:

- vector chunks
- indexed passages
- summaries
- embeddings
- cached representations
- search-result snippets

These are retrieval mechanisms, not necessarily authoritative sources.

Whenever possible, resolve the retrieved evidence back to the **original artifact**.

```text
retrieved chunk
      ↓
source metadata
      ↓
original document
      ↓
original section
      ↓
answer
      ↓
original-source citation
```

Prefer citations that allow the learner to navigate directly to the originating document and relevant section.

---

## Step 4: Inspect Provenance

When available, inspect:

```text
title
source_system
source_uri
file_path
repository
author
last_modified
section
version
document_status
```

Use provenance to identify conflicting, deprecated, or potentially stale information.

---

## Step 5: Synthesize

Answer the user's actual question rather than returning raw search results.

Prefer:

```text
Answer
Evidence
Original Sources
Caveats
```

Keep retrieval answers concise unless additional explanation is requested.

---

## Step 6: Handle Knowledge Gaps

If evidence is:

- unavailable
- contradictory
- stale
- ambiguous
- incomplete

state the limitation explicitly.

Never silently convert general model knowledge into organizational truth.

Example:

> The available organizational sources do not establish this behavior. The retrieved implementation references suggest a pattern, but I could not locate an authoritative source confirming it as the approved team standard.

---

# Mode 2 — Stateful Teaching Workflow

## Step 1: Establish Objectives

Read `MISSION.md`.

If sufficient context exists, continue without interviewing the learner again.

If objectives are not sufficiently defined, ask only the minimum questions necessary to establish:

```text
role
objective
target domain
target capability
desired outcome
success criteria
```

Persist durable learning objectives to `MISSION.md`.

The learner's objectives SHOULD determine what is taught and in what order.

---

## Step 2: Assess Current Mastery

Inspect `learning-records/`.

Determine:

```text
demonstrated concepts
partial concepts
unverified assumptions
knowledge gaps
prerequisites
```

Use these records to estimate the learner's current **Zone of Proximal Development (ZPD)**.

Select a concept that is:

```text
aligned with objectives
        +
known enough to approach
        +
new enough to require reasoning
        +
relevant to the learner's role
```

Do not reteach demonstrated concepts unless reinforcement is useful or requested.

---

## Step 3: Discover Original Sources

Search approved organizational knowledge for the selected concept.

Prioritize:

1. canonical documentation
2. architecture and ADRs
3. operational runbooks
4. maintained implementation guidance
5. documented team conventions
6. historical context

Resolve retrieved chunks or search results back to their original artifacts whenever possible.

Append newly discovered source references to `RESOURCES.md`.

Avoid duplicate entries.

---

## Step 4: Build the Micro-Lesson

Create:

```text
lessons/XXXX-<topic>.html
```

Each lesson SHOULD contain:

### Objective

State what capability the learner should demonstrate by the end of the lesson.

Tie the lesson objective back to `MISSION.md`.

### Core Concept

Teach the concept using organizational sources.

Every organizational statement MUST cite its original source.

Clearly distinguish documented facts from explanatory interpretation.

### Concrete Scenario

Present a realistic architecture, implementation, operational, or failure scenario.

Prefer scenarios derived from documented team systems.

### Active Retrieval Practice

Include 1–2 questions requiring the learner to recall or reason about the concept.

Examples:

- multiple choice
- identify the failure
- select the correct architecture
- predict system behavior
- explain a trade-off

### Hands-on Contribution

Require a small contribution.

Examples:

```text
5–10 lines of code
configuration fragment
CLI sequence
architecture decision
debugging diagnosis
API usage
query
implementation choice
```

The challenge SHOULD test understanding rather than copying from the lesson.

### Original Sources

List the original organizational artifacts used to construct the lesson.

Where possible, include:

```text
document title
source URI
section
version
last modified
```

---

# Step 5: Evaluate Understanding

Evaluate the learner's response against the original organizational evidence.

Do not evaluate solely on exact wording.

Look for:

```text
conceptual correctness
application
reasoning
organizational alignment
ability to identify trade-offs
```

Classify mastery as:

```text
demonstrated
partial
needs-review
```

When incorrect, explain the gap and allow another attempt before advancing.

---

# Step 6: Record Mastery

Create:

```text
learning-records/XXXX-<topic>.md
```

Record only demonstrated or meaningfully attempted knowledge.

Include:

```text
objective
concept
original source citations
challenge
learner reasoning
evaluation
mastery status
remaining gaps
recommended next concept
```

Do not store unnecessary conversational history.

---

# Step 7: Advance the Learning Path

Determine the next action from the learner's objectives and demonstrated mastery.

Possible actions:

```text
advance to prerequisite-dependent concept
deepen current concept
introduce production scenario
generate reference material
revisit weak concept
connect concept to another system
```

The learning path SHOULD emerge dynamically from:

```text
OBJECTIVES
+
ORIGINAL ORGANIZATIONAL KNOWLEDGE
+
DEMONSTRATED MASTERY
```

Do not require a rigid predefined curriculum.

---

# Teaching Principles

## Objective-Driven Learning

Every teaching activity SHOULD answer:

> How does this move the learner closer to their stated objective?

Avoid teaching material merely because it exists in the knowledge store.

---

## Retrieval Before Instruction

For organizational topics:

```text
retrieve → resolve original source → verify → teach → cite
```

Never:

```text
assume → teach → search later
```

---

## Evidence Over Completion

Completing a lesson does not imply mastery.

Mastery requires evidence through recall, explanation, diagnosis, implementation, or application.

---

## Progressive Disclosure

Do not expose the entire knowledge base at once.

Teach the smallest concept necessary to unlock the next useful capability.

```text
objective
   ↓
concept
   ↓
practice
   ↓
evidence
   ↓
next concept
```

---

## Active Learning

Prefer:

```text
recall
diagnosis
implementation
comparison
prediction
debugging
decision-making
```

over passive summarization.

---

## Adaptive Difficulty

If the learner consistently demonstrates mastery:

- reduce explanation
- increase ambiguity
- introduce trade-offs
- use realistic production scenarios
- combine multiple concepts

If the learner struggles:

- reduce scope
- expose prerequisite concepts
- provide additional examples
- generate reference material
- retry with a smaller challenge

---

# Source Grounding Rules

## Original Source Principle

The citation chain MUST terminate at the original organizational artifact.

Valid:

```text
lesson
  └── Architecture Standard
        └── original SharePoint / Drive / Git / S3 source
```

Invalid:

```text
lesson
  └── RESOURCES.md
```

Invalid:

```text
lesson
  └── generated reference.html
        └── generated summary
```

Generated artifacts MAY help navigation, teaching, or retrieval, but they MUST NOT replace original-source attribution.

---

## Organizational Claims

Every statement presented as:

- team policy
- approved architecture
- internal convention
- operational procedure
- implementation requirement
- organizational recommendation

MUST be supported by an approved original organizational artifact.

---

## General Knowledge

General technical knowledge MAY be used to explain an organizational concept when useful.

It MUST be clearly distinguishable from organizational guidance.

Example:

> In general distributed-system design, retries are commonly paired with exponential backoff. The team's documented retry requirements, however, are defined in `<original-source>`.

General knowledge MUST NOT override documented organizational practices.

---

## Conflicting Sources

When authoritative sources disagree:

1. identify the conflict
2. compare provenance and freshness
3. prefer explicitly canonical or active documentation
4. cite both original sources when relevant
5. expose unresolved ambiguity
6. do not silently choose a policy

---

# Resource Trust Model

When useful, classify discovered resources:

```text
CANONICAL
ACTIVE
SUPPORTING
HISTORICAL
UNVERIFIED
```

Teaching SHOULD primarily use `CANONICAL` and `ACTIVE` resources.

Historical resources MAY explain why a decision exists but MUST NOT automatically be treated as current guidance.

---

# Required Guardrails

## Strict Organizational Grounding

Never fabricate internal conventions, policies, architectures, procedures, or implementation standards.

If organizational evidence cannot be retrieved, say so.

---

## Original Source Citation

Every generated lesson, reference guide, retrieval answer, or mastery record containing organizational knowledge MUST retain traceability to the original organizational artifact.

`RESOURCES.md`, generated lessons, summaries, vector chunks, and reference files are **navigation or derived artifacts—not authoritative replacements for the original source**.

---

## Minimal Knowledge Persistence

Persist only information required for:

- learning objectives
- learning continuity
- mastery assessment
- resource provenance
- future lesson selection

Do not persist unnecessary personal or conversational information.

---

## No False Mastery

Never mark a concept as `demonstrated` solely because:

- the learner read the lesson
- the learner said they understand
- the topic was previously discussed

Require observable evidence.

---

## Version Control Enforcement

When contributing lesson repositories, reference material, or skill definitions back to Git:

- use native Git for local version-control operations
- use the authenticated `gh` CLI for GitHub operations
- use commands such as `gh pr create` and `gh issue create`

Do NOT use GitHub mutation connectors or MCP-based pull-request/issue creation tools when this skill is active.

---

# Success Criteria

The skill is functioning correctly when it can:

1. Answer team-specific questions with citations to original organizational sources.
2. Resolve indexed or retrieved knowledge back to its originating artifact.
3. Explicitly identify unavailable, stale, ambiguous, or conflicting organizational knowledge.
4. Establish learner objectives and use them to drive the learning path.
5. Teach concepts grounded in approved team artifacts.
6. Adapt lessons based on previously demonstrated mastery.
7. Distinguish learning activity from actual competency.
8. Preserve learning continuity across sessions.
9. Generate concise reusable reference material without breaking original-source provenance.
10. Progressively move the learner from **retrieval → understanding → application → independent reasoning**.
