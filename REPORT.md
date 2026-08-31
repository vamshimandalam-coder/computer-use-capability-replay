# Computer-Use Automation System

## Architecture

The system is a single TypeScript process with explicit boundaries: a planner performs discovery, `BrowserSurface` observes and controls the UI, the policy engine authorizes every step, the recorder accumulates only executed actions, and replay consumes the resulting runtime-validated capability. On success the recorder converts resolved controls into ordered locator bundles, replaces matching invocation values with typed input references, and attaches verified post-action headings as checkpoints. A local Express application represents a server-rendered credit-union tool. The compact architecture favors an inspectable vertical slice over queues or services.

## Artifact schema

The JSON artifact has independent schema and capability versions, application/version compatibility, typed input and output contracts, ordered steps, target descriptions with ordered locator bundles, waits, checkpoints, risk classes, known business outcomes, bounded recoveries, escalation rules, success conditions, and redaction metadata. Browser targets form a surface-tagged union so future desktop or coordinate targets can be added without changing workflow semantics. Inputs reference invocation keys instead of retaining discovery values. Output definitions combine a durable target and an explicit transform. The artifact is human-reviewable and validated both when saved and loaded.

## Determinism & error handling

Replay executes artifact order and locator order without importing a planner. Each candidate must resolve to exactly one visible control; ambiguity fails rather than guessing. Waits are bounded and checkpoints verify state transitions. Known business outcomes return stable codes, recoverable conditions may invoke only the artifact's bounded recovery, and hard failures return step, expectation, safe observation, retryability, and evidence. Logs state `modelCalls: 0`, and an end-to-end test asserts it. No LLM repairs replay.

## Heterogeneity & multi-tenant

The surface seam owns observation, control resolution, action execution, extraction, checkpoints, screenshots, and the live session. A desktop adapter could implement those operations with an accessibility tree and a separately tagged desktop target; coordinates would remain a limited final fallback. Vendor-level capabilities carry application/version constraints. Tenant configuration would select a compatible base, supply route and locator overrides, run compatibility probes, and record drift. Overrides would be reviewed and versioned, with rollback to the last approved capability rather than silently mutating the base.

## Escalation & handoff

Policy blocks, ambiguous controls, failed checkpoints, and unrecoverable runtime states produce intervention context. The ownership state machine moves through requested, paused, human control, and explicit resume/complete/abort states; illegal shortcuts fail. The operator receives the same Playwright page and browser context, so cookies and session state persist. Human clicks are timestamped with redacted targets. Resume re-enters automation only after an explicit decision; a production console and identity-aware audit transport are deliberate cuts.

## Safety

One engine enforces origin, route, action, and risk policy in discovery and replay. Safe actions proceed, reversible actions require configuration, risky actions need approval, and irreversible actions are blocked by default. Page content is input, never policy. Recursive redaction covers credentials, tokens, cookies, member/account identifiers, and sensitive values. Evidence uses synthetic records. Remaining limits include process-local policy configuration and a minimal manual-approval interface.

## Cuts

The project omits distributed execution, a capability catalog, real tenant infrastructure, desktop adapters, visual matching, and a polished co-browsing console. These do not improve the evaluated core. Next work would add a headed operator CLI demonstration, signed approval state, compatibility probes and drift reports, then one accessibility-based desktop adapter.
