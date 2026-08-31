import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { relative } from 'node:path';
import { chromium } from '@playwright/test';
import type { Planner } from './planner.js';
import { BrowserSurface } from '../surfaces/browser.js';
import { PolicyEngine } from '../policy/policy.js';
import { createSavingsCapability } from '../artifacts/sample.js';
import { saveCapability } from '../artifacts/io.js';
import { redact } from '../observability/redact.js';
import type { Capability, LocatorSpec } from '../domain/artifact.js';
export async function discover(options: {
  goal: string;
  target: string;
  inputs: Record<string, unknown>;
  planner: Planner;
  maxSteps: number;
  timeoutMs: number;
  evidenceDir: string;
  artifactPath: string;
}): Promise<void> {
  const runId = randomUUID(),
    start = Date.now();
  await mkdir(options.evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const surface = new BrowserSurface(context, page, options.evidenceDir);
  const policy = new PolicyEngine({
    origins: [new URL(options.target).origin],
    routes: [/^\/$/, /^\/search$/, /^\/member\/\d+(\/savings)?$/],
    actions: ['navigate', 'fill', 'click'],
    allowReversible: false,
    approvedRisky: false,
  });
  const inputStrings = Object.values(options.inputs).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  const safeText = (value: string) =>
    inputStrings.reduce((text, input) => text.replaceAll(input, '[REDACTED_INPUT]'), value);
  const events: unknown[] = [
    {
      event: 'discovery_started',
      runId,
      goal: safeText(options.goal),
      provider: options.planner.provider,
      model: options.planner.model,
      inputs: redact(options.inputs),
    },
  ];
  const recordedSteps: Capability['steps'] = [
    {
      id: 'open-app',
      action: 'navigate',
      value: { source: 'literal', value: options.target },
      risk: 'safe',
      waitMs: 5000,
    },
  ];
  let calls = 0;
  try {
    policy.checkUrl(options.target);
    await page.goto(options.target);
    for (let n = 0; n < options.maxSteps; n++) {
      if (Date.now() - start > options.timeoutMs) throw new Error('Discovery timeout');
      const observation = await surface.observe(`step-${n}-observation`);
      const decision = await options.planner.decide(options.goal, observation, options.inputs);
      calls++;
      events.push({
        event: 'model_decision',
        step: n,
        decision: {
          ...decision,
          value: decision.value ? '[REDACTED_INPUT]' : '',
          justification: safeText(decision.justification),
        },
        observation: {
          url: safeText(observation.url),
          title: observation.title,
          controls: observation.controls,
          screenshot: observation.screenshot,
        },
      });
      if (decision.action === 'done') {
        const capability = createSavingsCapability(recordedSteps, options.target);
        if (!(await surface.checkpoint(capability.success)))
          throw new Error('Model declared done before checkpoint');
        await saveCapability(options.artifactPath, capability);
        events.push({
          event: 'discovery_succeeded',
          checkpoint: capability.success,
          recordedStepIds: capability.steps.map((step) => step.id),
          artifact: relative(process.cwd(), options.artifactPath).replaceAll('\\', '/'),
          modelCalls: calls,
        });
        return;
      }
      const target =
        decision.action === 'fill'
          ? page.getByLabel(decision.target ?? '')
          : page
              .getByRole('button', { name: decision.target ?? '' })
              .or(page.getByRole('link', { name: decision.target ?? '' }));
      if ((await target.count()) !== 1)
        throw new Error(`Decision target was not uniquely resolvable: ${decision.target}`);
      const elementName = decision.target ?? '';
      const locators: LocatorSpec[] = [];
      if (decision.action === 'fill') {
        locators.push({ kind: 'label', label: elementName });
        const name = await target.getAttribute('name');
        if (name) locators.push({ kind: 'attribute', name: 'name', value: name });
      } else {
        const tag = await target.evaluate((element) => element.tagName.toLowerCase());
        locators.push({ kind: 'role', role: tag === 'a' ? 'link' : 'button', name: elementName });
        locators.push({ kind: 'text', text: elementName, exact: true });
      }
      const executionValue =
        decision.value === '$memberId' ? String(options.inputs.memberId) : (decision.value ?? '');
      const matchingInput = Object.entries(options.inputs).find(
        ([, value]) => String(value) === executionValue,
      );
      const step: Capability['steps'][number] = {
        id: `${decision.action}-${elementName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')}`,
        action: decision.action,
        target: {
          surface: 'browser' as const,
          description: elementName,
          framePath: [],
          locators,
        },
        value:
          decision.action === 'fill'
            ? matchingInput
              ? { source: 'input' as const, key: matchingInput[0] }
              : { source: 'literal' as const, value: executionValue }
            : undefined,
        risk: 'safe' as const,
        waitMs: 5000,
      };
      policy.checkAction(step);
      if (decision.action === 'fill') await target.fill(executionValue);
      else await target.click();
      await policy.enforcePage(page);
      if (decision.action === 'click') {
        const heading = (await page.locator('h1').first().innerText()).trim();
        step.checkpoint = { kind: 'visibleText', expected: heading };
      }
      recordedSteps.push(step);
      events.push({
        event: 'action_executed',
        step: n,
        policy: 'allowed',
        recordedStep: { ...step, value: step.value ? '[PARAMETERIZED]' : undefined },
      });
    }
    throw new Error('Maximum steps reached');
  } finally {
    events.push({ event: 'discovery_finished', modelCalls: calls, durationMs: Date.now() - start });
    await writeFile(`${options.evidenceDir}/run.json`, JSON.stringify(events, null, 2));
    await browser.close();
  }
}
