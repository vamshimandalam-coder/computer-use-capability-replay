# Execution plan

## Objective

Deliver a small, defensible record-once/replay-many computer-use system against a synthetic credit-union UI.

## Scope

LLM discovery, browser surface adapter, typed artifact, deterministic replay, runtime taxonomy, policy, redaction, evidence, and same-session handoff seam. Desktop and multi-tenant support are design-only.

## Explicit non-goals

Production infrastructure, real banking data, API integration, a full co-browsing console, and open-ended model recovery during replay.

## Milestones

1. Analysis and architecture — complete.
2. Foundation — complete.
3. Demo surface and browser adapter — complete.
4. Discovery — complete, including genuine provider evidence.
5. Artifact and replay — complete.
6. Runtime conditions and safety — core path complete.
7. Human handoff — complete with same-session evidence.
8. Evidence — complete for discovery, success, business outcome, hard failure, and handoff.
9. Final audit — complete.

## Dependencies

Node.js 22, Playwright Chromium, and an OpenAI API key only for the genuine discovery run.

## Risks and mitigations

UI ambiguity fails closed; route and action policy is checked per step; sensitive inputs are recursively redacted; retries are bounded by the artifact; replay has no planner dependency.

## Definition of done

All checks pass and committed evidence includes genuine LLM discovery, deterministic success and exception, and same-session handoff.
