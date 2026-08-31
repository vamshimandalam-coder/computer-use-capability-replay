# Decision log

- TypeScript, Zod, and Playwright: one typed process keeps the vertical slice inspectable; Python/Selenium offered no benefit here.
- Local synthetic banking surface: safe, reproducible, and capable of deliberate business and permission outcomes; public sites introduce policy and availability risk.
- Accessibility-first observations and ordered locator bundles: portable beyond clean DOM selectors; screenshot-only control was rejected as unnecessarily fragile for this target.
- JSON capability with runtime validation: reviewable and provider-independent; raw transcripts and generated scripts do not provide invocation contracts.
- Discriminated results: business outcomes are domain answers, recoveries are bounded, and hard failures stop with diagnostics.
- Explicit ownership state machine: prevents automation and humans acting concurrently while preserving one browser context.
- One shared policy engine: model decisions cannot expand domain, route, action, or risk permissions.
- Deliberate cut: no desktop adapter or tenant infrastructure; the adapter and compatibility metadata preserve those seams.
