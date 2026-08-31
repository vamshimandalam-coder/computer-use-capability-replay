# Requirements matrix

| ID  | Requirement                                          | Implementation                           | Verification                                  | Evidence                  | Status   |
| --- | ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------- | ------------------------- | -------- |
| 3.1 | Goal + target and live LLM observe/decide/act        | `src/agent`, `src/surfaces`              | genuine OpenAI run and browser evidence       | `evidence/discovery`      | Complete |
| 3.2 | Typed, versioned, parameterized artifact and outputs | `src/domain/artifact.ts`, `schemas/`     | runtime and portable-schema tests             | `evidence/artifacts`      | Complete |
| 3.3 | Deterministic replay, checkpoints, result taxonomy   | `src/replay`                             | replay, recovery, outcome and zero-call tests | replay directories        | Complete |
| 3.4 | Allowlists, risk policy, redaction                   | `src/policy`, `src/observability`        | unit tests                                    | structured policy events  | Complete |
| 3.5 | Structured logs and rich failure signal              | discovery/replay writers and screenshots | permission-denied replay                      | `evidence/replay-failure` | Complete |
| 3.6 | Same-session human handoff and ownership             | `src/escalation/handoff.ts`              | state and browser continuity tests            | `evidence/handoff`        | Complete |
| 3.7 | Surface and tenant extension design                  | surface target union and REPORT          | design review                                 | REPORT                    | Complete |
| 5   | Complete vertical slice and deliberate cuts          | project and REPORT                       | full command suite                            | `evidence/`               | Complete |
| 6.1 | README setup and exact demo path                     | `README.md`                              | command audit                                 | n/a                       | Complete |
| 6.2 | REPORT exact seven headings                          | `REPORT.md`                              | heading audit                                 | n/a                       | Complete |
| 6.3 | Artifact and discovery/replay evidence               | `evidence/`                              | actual runs only                              | `evidence/`               | Complete |
