import { test, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { replay } from '../../src/replay/replay.js';
import { savingsCapability } from '../../src/artifacts/sample.js';
import { demonstrateHandoff } from '../../src/escalation/demo.js';
import { readFile } from 'node:fs/promises';
import { startLegacyBank } from '../../demo/legacy-bank/server.js';
import { discover } from '../../src/agent/discovery.js';
import { ScriptedPlanner } from '../../src/agent/planner.js';
import { loadCapability } from '../../src/artifacts/io.js';
import { DEFAULT_TARGET_URL } from '../../src/config/heritage.js';
let server: Server;
test.beforeAll(
  async () =>
    new Promise<void>((resolve) => {
      server = startLegacyBank(4317, resolve);
    }),
);
test.afterAll(
  async () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);
test('discovery artifact is constructed from executed parameterized actions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recording-'));
  const artifactPath = join(directory, 'capability.json');
  await discover({
    goal: 'Look up member 10001 and read the current savings balance',
    target: DEFAULT_TARGET_URL,
    inputs: { memberId: '10001' },
    planner: new ScriptedPlanner(),
    maxSteps: 8,
    timeoutMs: 30_000,
    evidenceDir: directory,
    artifactPath,
  });
  const capability = await loadCapability(artifactPath);
  expect(capability.steps.map((step) => step.id)).toEqual([
    'open-app',
    'fill-member-number',
    'click-search-members',
    'click-open-member-record',
    'click-savings-account',
  ]);
  expect(capability.steps[1]?.value).toEqual({ source: 'input', key: 'memberId' });
  const log = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
    event: string;
    recordedStepIds?: string[];
  }[];
  expect(log.find((entry) => entry.event === 'discovery_succeeded')?.recordedStepIds).toEqual(
    capability.steps.map((step) => step.id),
  );
});
test('parameterized deterministic replay returns typed output and zero model calls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'replay-'));
  const result = await replay(savingsCapability, { memberId: '10002' }, directory);
  expect(result.status).toBe('success');
  if (result.status === 'success') {
    expect(result.outputs.balance).toBe(923.1);
    expect(result.modelCalls).toBe(0);
  }
  const evidence = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
    event: string;
    code?: string;
    attempt?: number;
    recovered?: boolean;
  }[];
  expect(evidence).toContainEqual(
    expect.objectContaining({
      event: 'recovery_attempt',
      code: 'KNOWN_SERVICE_INTERSTITIAL',
      attempt: 1,
      recovered: true,
    }),
  );
});
test('permission denied is a precise hard-failure category', async () => {
  const result = await replay(
    savingsCapability,
    { memberId: '99999' },
    await mkdtemp(join(tmpdir(), 'permission-')),
  );
  expect(result).toEqual(
    expect.objectContaining({
      status: 'failure',
      category: 'permission',
      code: 'PERMISSION_DENIED',
      retryable: false,
    }),
  );
});
test('invalid input fails against the typed contract before navigation', async () => {
  const result = await replay(
    savingsCapability,
    { memberId: 'abc' },
    await mkdtemp(join(tmpdir(), 'invalid-input-')),
  );
  expect(result).toEqual(
    expect.objectContaining({
      status: 'failure',
      category: 'input',
      code: 'INPUT_VALIDATION_FAILED',
      stepId: 'input-validation',
      retryable: false,
    }),
  );
});
test('replay failure routes same-session human control and resumes with outputs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'integrated-handoff-'));
  const result = await replay(savingsCapability, { memberId: '99999' }, directory, {
    operator: {
      async intervene(_request, page) {
        await page.goto(DEFAULT_TARGET_URL);
        await page.getByLabel('Member number').fill('10001');
        await page.getByRole('button', { name: 'Search members' }).click();
        await page.getByRole('link', { name: 'Open member record' }).click();
        await page.getByRole('link', { name: 'Savings account' }).click();
        return 'resume';
      },
    },
  });
  expect(result).toEqual(expect.objectContaining({ status: 'success', modelCalls: 0 }));
  const evidence = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
    event: string;
    sessionPreserved?: boolean;
    decision?: string;
    humanActions?: unknown[];
  }[];
  expect(evidence).toContainEqual(
    expect.objectContaining({
      event: 'human_handoff',
      decision: 'resume',
      sessionPreserved: true,
    }),
  );
  expect(
    evidence.find((entry) => entry.event === 'human_handoff')?.humanActions?.length,
  ).toBeGreaterThan(0);
});
test('not found is a business outcome, not a crash', async () => {
  const result = await replay(
    savingsCapability,
    { memberId: '12345' },
    await mkdtemp(join(tmpdir(), 'outcome-')),
  );
  expect(result.status).toBe('business_outcome');
});
test('handoff preserves the browser session and returns ownership to automation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'handoff-'));
  await demonstrateHandoff(DEFAULT_TARGET_URL, directory);
  const evidence = JSON.parse(await readFile(join(directory, 'run.json'), 'utf8')) as {
    sessionPreserved: boolean;
    states: string[];
    humanActions: unknown[];
  };
  expect(evidence.sessionPreserved).toBe(true);
  expect(evidence.states).toEqual([
    'AUTOMATION_RUNNING',
    'INTERVENTION_REQUESTED',
    'AUTOMATION_PAUSED',
    'HUMAN_CONTROL',
    'RESUME_REQUESTED',
    'AUTOMATION_RUNNING',
  ]);
  expect(evidence.humanActions).toHaveLength(1);
});
