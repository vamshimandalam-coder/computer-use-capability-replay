import type { Capability } from '../domain/artifact.js';
type BrowserTarget = NonNullable<Capability['steps'][number]['target']>;
const target = (description: string, locators: BrowserTarget['locators']): BrowserTarget => ({
  surface: 'browser',
  description,
  framePath: [],
  locators,
});
const baseSteps: Capability['steps'] = [
  {
    id: 'open-app',
    action: 'navigate',
    value: { source: 'literal', value: 'http://127.0.0.1:4317/' },
    risk: 'safe',
    waitMs: 5000,
  },
  {
    id: 'enter-member',
    action: 'fill',
    target: target('member number field', [
      { kind: 'label', label: 'Member number' },
      { kind: 'attribute', name: 'name', value: 'member' },
    ]),
    value: { source: 'input', key: 'memberId' },
    risk: 'safe',
    waitMs: 5000,
  },
  {
    id: 'search',
    action: 'click',
    target: target('search button', [
      { kind: 'role', role: 'button', name: 'Search members' },
      { kind: 'text', text: 'Search members', exact: true },
    ]),
    risk: 'safe',
    waitMs: 5000,
    checkpoint: { kind: 'visibleText', expected: 'Search results' },
  },
  {
    id: 'open-member',
    action: 'click',
    target: target('member record link', [
      { kind: 'role', role: 'link', name: 'Open member record' },
      { kind: 'text', text: 'Open member record', exact: true },
    ]),
    risk: 'safe',
    waitMs: 5000,
    checkpoint: { kind: 'visibleText', expected: 'Member record' },
  },
  {
    id: 'open-savings',
    action: 'click',
    target: target('savings account link', [
      { kind: 'role', role: 'link', name: 'Savings account' },
      { kind: 'text', text: 'Savings account', exact: true },
    ]),
    risk: 'safe',
    waitMs: 5000,
    checkpoint: { kind: 'visibleText', expected: 'Current savings balance' },
  },
];

export function createSavingsCapability(
  steps: Capability['steps'] = baseSteps,
  targetUrl = 'http://127.0.0.1:4317/',
): Capability {
  const recordedSteps = steps.map((step) =>
    step.action === 'navigate'
      ? { ...step, value: { source: 'literal' as const, value: targetUrl } }
      : step,
  );
  return {
    schemaVersion: '1.0',
    capability: {
      id: 'heritage.read-savings-balance',
      name: 'Read savings balance',
      version: '1.0.0',
      description: 'Find a synthetic member and return the current savings balance.',
      lifecycle: 'draft',
    },
    compatibility: {
      surface: 'browser',
      application: 'Heritage CU Operator',
      vendor: 'Synthetic Heritage',
      versions: ['1.x'],
      tenantOverrides: {},
    },
    inputs: {
      memberId: {
        type: 'string',
        required: true,
        pattern: '^[0-9]{5}$',
        description: 'Synthetic member number',
        sensitive: true,
      },
    },
    outputs: {
      balance: {
        type: 'number',
        description: 'Current savings balance in USD',
        target: target('balance cell', [{ kind: 'css', selector: '.balance' }]),
        transform: 'currency',
      },
    },
    preconditions: [],
    steps: recordedSteps,
    businessOutcomes: [
      { code: 'MEMBER_NOT_FOUND', when: { kind: 'visibleText', expected: 'No member found' } },
    ],
    recoveries: [
      {
        code: 'KNOWN_SERVICE_INTERSTITIAL',
        when: { kind: 'visibleText', expected: 'Temporary service notice' },
        action: {
          id: 'dismiss-service-interstitial',
          action: 'click',
          target: target('continue link', [
            { kind: 'role', role: 'link', name: 'Continue' },
            { kind: 'text', text: 'Continue', exact: true },
          ]),
          risk: 'safe',
          waitMs: 5000,
          checkpoint: { kind: 'visibleText', expected: 'Search results' },
        },
        maxAttempts: 1,
      },
    ],
    escalation: {
      on: [
        'CONTROL_NOT_FOUND',
        'AMBIGUOUS_CONTROL',
        'PERMISSION_DENIED',
        'HUMAN_APPROVAL_REQUIRED',
      ],
      requestedAction: 'Inspect the live page, correct the state, and explicitly resume or abort.',
    },
    success: { kind: 'visibleText', expected: 'Current savings balance' },
    redaction: { inputKeys: ['memberId'], outputKeys: [] },
  };
}

export const savingsCapability = createSavingsCapability();
