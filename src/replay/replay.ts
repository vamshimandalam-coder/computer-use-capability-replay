import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { relative } from 'node:path';
import { chromium } from '@playwright/test';
import type { Capability, RunResult } from '../domain/artifact.js';
import { BrowserSurface, SurfaceFailure } from '../surfaces/browser.js';
import { PolicyEngine, PolicyError } from '../policy/policy.js';
import { redact } from '../observability/redact.js';
import { HandoffController, type Operator } from '../escalation/handoff.js';

class RuntimeFailure extends Error {
  constructor(
    readonly code: 'PERMISSION_DENIED' | 'RECOVERY_EXHAUSTED',
    readonly category: 'permission' | 'surface',
    message: string,
  ) {
    super(message);
  }
}
export interface ReplayOptions {
  operator?: Operator;
}
export async function replay(
  cap: Capability,
  inputs: Record<string, unknown>,
  evidenceDir: string,
  options: ReplayOptions = {},
): Promise<RunResult> {
  const started = Date.now(),
    runId = randomUUID();
  await mkdir(evidenceDir, { recursive: true });
  const log: unknown[] = [
    {
      event: 'run_started',
      runId,
      mode: 'deterministic_replay',
      modelInitialized: false,
      modelCalls: 0,
      inputs: redact(inputs),
    },
  ];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'automation-session', value: runId, url: 'http://127.0.0.1:4317/' },
  ]);
  const page = await context.newPage();
  const surface = new BrowserSurface(context, page, evidenceDir);
  const policy = new PolicyEngine({
    origins: ['http://127.0.0.1:4317'],
    routes: [/^\/$/, /^\/search$/, /^\/resume\/\d+$/, /^\/member\/\d+(\/savings)?$/],
    actions: ['navigate', 'fill', 'click', 'select'],
    allowReversible: true,
    approvedRisky: false,
  });
  let stepId = 'input-validation';
  const evidenceRef = (path: string) => relative(process.cwd(), path).replaceAll('\\', '/');
  const finish = async (result: RunResult) => {
    log.push({ event: 'run_finished', result });
    await writeFile(`${evidenceDir}/run.json`, JSON.stringify(log, null, 2));
    await browser.close();
    return result;
  };
  const extractOutputs = async () => {
    const outputs: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(cap.outputs)) outputs[key] = await surface.extract(def);
    return outputs;
  };
  const applyRecoveries = async () => {
    for (const recovery of cap.recoveries) {
      if (!(await surface.checkpoint(recovery.when))) continue;
      let recovered = false;
      for (let attempt = 1; attempt <= recovery.maxAttempts; attempt++) {
        policy.checkAction(recovery.action);
        const strategy = await surface.execute(recovery.action, inputs);
        await policy.enforcePage(page);
        recovered = recovery.action.checkpoint
          ? await surface.checkpoint(recovery.action.checkpoint)
          : !(await surface.checkpoint(recovery.when));
        log.push({
          event: 'recovery_attempt',
          code: recovery.code,
          attempt,
          maxAttempts: recovery.maxAttempts,
          strategy,
          recovered,
          modelCalls: 0,
        });
        if (recovered) break;
      }
      if (!recovered) throw new RuntimeFailure('RECOVERY_EXHAUSTED', 'surface', recovery.code);
    }
  };
  try {
    for (const [key, def] of Object.entries(cap.inputs)) {
      const value = inputs[key];
      if (def.required && value === undefined) throw new Error(`Missing input ${key}`);
      if (def.pattern && typeof value === 'string' && !new RegExp(def.pattern).test(value))
        throw new Error(`Invalid input ${key}`);
    }
    for (const step of cap.steps) {
      stepId = step.id;
      policy.checkAction(step);
      if (step.action === 'navigate' && step.value?.source === 'literal')
        policy.checkUrl(step.value.value);
      const strategy = await surface.execute(step, inputs);
      await policy.enforcePage(page);
      log.push({ event: 'step_completed', stepId, strategy, modelCalls: 0 });
      if (await surface.checkpoint({ kind: 'visibleText', expected: 'Permission denied' }))
        throw new RuntimeFailure(
          'PERMISSION_DENIED',
          'permission',
          'The application denied access.',
        );
      await applyRecoveries();
      for (const outcome of cap.businessOutcomes)
        if (await surface.checkpoint(outcome.when))
          return finish({
            status: 'business_outcome',
            runId,
            code: outcome.code,
            details: 'The application returned a known domain result.',
            evidence: [evidenceRef(`${evidenceDir}/run.json`)],
            modelCalls: 0,
          });
      if (step.checkpoint && !(await surface.checkpoint(step.checkpoint)))
        throw new SurfaceFailure('CHECKPOINT_MISMATCH', step.checkpoint.expected);
    }
    if (!(await surface.checkpoint(cap.success)))
      throw new SurfaceFailure('CHECKPOINT_MISMATCH', cap.success.expected);
    const outputs = await extractOutputs();
    return finish({
      status: 'success',
      runId,
      capability: `${cap.capability.id}@${cap.capability.version}`,
      outputs,
      completedStep: stepId,
      durationMs: Date.now() - started,
      evidence: [evidenceRef(`${evidenceDir}/run.json`)],
      modelCalls: 0,
    });
  } catch (error) {
    const shot = await surface.observe('failure').catch(() => undefined);
    const policyError = error instanceof PolicyError;
    const surfaceError = error instanceof SurfaceFailure;
    const runtimeError = error instanceof RuntimeFailure;
    const code = policyError
      ? error.code
      : runtimeError
        ? error.code
        : surfaceError
          ? error.code
          : 'INVALID_INPUT';
    const category = policyError
      ? 'policy'
      : runtimeError
        ? error.category
        : surfaceError
          ? error.code === 'CHECKPOINT_MISMATCH'
            ? 'checkpoint'
            : error.code === 'AMBIGUOUS_CONTROL'
              ? 'ambiguous'
              : 'surface'
          : 'surface';
    const intervention = cap.escalation.on.includes(code)
      ? {
          runId,
          capability: cap.capability.id,
          stepId,
          reason: code,
          url: page.url(),
          observation: shot?.text.slice(0, 300) ?? String(error),
          screenshot: shot?.screenshot ?? '',
          risk: policyError ? 'policy-blocked' : 'runtime',
          requestedAction: cap.escalation.requestedAction,
          owner: 'INTERVENTION_REQUESTED' as const,
        }
      : undefined;
    if (intervention && options.operator) {
      const controller = new HandoffController(context, page);
      const states = [controller.owner];
      const sessionBefore = (await context.cookies()).find(
        (cookie) => cookie.name === 'automation-session',
      )?.value;
      controller.on('transition', (state) => states.push(state));
      const decision = await controller.handoff(intervention, options.operator);
      const sessionAfter = (await context.cookies()).find(
        (cookie) => cookie.name === 'automation-session',
      )?.value;
      log.push({
        event: 'human_handoff',
        decision,
        states,
        humanActions: controller.humanActions,
        sessionPreserved: sessionBefore === sessionAfter,
        modelCalls: 0,
      });
      if (decision === 'resume' && (await surface.checkpoint(cap.success))) {
        return finish({
          status: 'success',
          runId,
          capability: `${cap.capability.id}@${cap.capability.version}`,
          outputs: await extractOutputs(),
          completedStep: `${stepId}:human-resume`,
          durationMs: Date.now() - started,
          evidence: [evidenceRef(`${evidenceDir}/run.json`), ...(shot ? [shot.screenshot] : [])],
          modelCalls: 0,
        });
      }
    }
    return finish({
      status: 'failure',
      runId,
      category,
      code,
      stepId,
      expected: 'step and checkpoint complete',
      observed: shot?.text.trim() ? shot.text.slice(0, 300) : String(error),
      retryable: false,
      evidence: [evidenceRef(`${evidenceDir}/run.json`), ...(shot ? [shot.screenshot] : [])],
      ...(intervention ? { escalation: intervention } : {}),
      modelCalls: 0,
    });
  }
}
