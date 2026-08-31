# Computer-Use Automation System

This project discovers a workflow through a live browser UI with an LLM, records verified actions as a typed capability, and replays that capability without a model. The target is a local, synthetic credit-union back-office application; no real customer data is used.

Record-once/replay-many moves model reasoning to discovery. Reviewed capabilities are then cheaper, predictable, policy-checked, parameterized, and debuggable in production.

The lifecycle is `goal → observe/decide/act → validated capability JSON → ordered deterministic replay → typed result`. Browser mechanics sit behind `BrowserSurface`; policy is authoritative in both execution paths. Replay cannot construct or import a planner.

A short narrated and captioned walkthrough is available at `evidence/video/computer-use-demo-narrated.webm`. The silent source is retained as `computer-use-demo.webm`.

## Setup

Prerequisites: Node.js 22 LTS and npm. Node 24 is accepted for local evaluation.

```sh
npm ci
npx playwright install chromium
```

Copy `.env.example` to `.env` only for local use. `OPENAI_API_KEY` is required solely for genuine discovery; never commit it. `OPENAI_MODEL` defaults to `gpt-5-mini`.

## Demo

In terminal one:

```sh
npm run start:target
```

Key-independent discovery with a deterministic test planner:

```sh
npm run demo -- discover --provider scripted --goal "Look up member 10001 and read the current savings balance" --member-id 10001
```

Genuine discovery (requires `OPENAI_API_KEY`):

```sh
npm run demo -- discover --provider openai --goal "Look up member 10001 and read the current savings balance" --member-id 10001 --evidence evidence/discovery --artifact evidence/artifacts/read-savings.json
```

Plain deterministic replay:

```sh
npm run demo -- replay --artifact evidence/artifacts/read-savings.json --member-id 10001 --evidence evidence/replay-success
```

Replay with a different valid input and one bounded interstitial recovery:

```sh
npm run demo -- replay --artifact evidence/artifacts/read-savings.json --member-id 10002 --evidence evidence/replay-recovery
```

Known business outcome:

```sh
npm run demo -- replay --artifact evidence/artifacts/read-savings.json --member-id 12345 --evidence evidence/replay-exception
```

Hard failure with diagnostic screenshot (intentionally exits nonzero):

```sh
npm run demo -- replay --artifact evidence/artifacts/read-savings.json --member-id 99999 --evidence evidence/replay-failure
```

Same-session handoff demonstration:

```sh
npm run demo -- replay-handoff-demo --artifact evidence/artifacts/read-savings.json --evidence evidence/handoff
```

The generated artifact is in `evidence/artifacts/`; structured run logs and screenshots are under the requested evidence directory. Every replay result and log contains `modelCalls: 0`; the replay module has no planner import.

## Verification

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit
```

## Structure and security

`src/agent` owns discovery, `src/artifacts` validation/storage, `src/surfaces` browser control, `src/replay` deterministic execution, `src/policy` allowlists, `src/escalation` ownership, `demo/legacy-bank` the target, and `tests` verification. The target is UI-only and synthetic. Navigation and action allowlists fail closed; irreversible actions are blocked and risky actions require explicit approval. Inputs, credentials, tokens, and identifiers are recursively redacted. Evidence paths are predictable and path traversal is rejected by the storage helper.

Important limitations: the operator experience is deliberately minimal; visual-coordinate and desktop adapters are not implemented; compatibility metadata is not a tenant registry; and repeating genuine discovery requires the operator's own model credential.

## Development note

AI-assisted development was used in this project.
