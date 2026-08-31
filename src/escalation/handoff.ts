import { EventEmitter } from 'node:events';
import type { BrowserContext, Page } from '@playwright/test';
import type { ControlOwner, InterventionRequest } from '../domain/artifact.js';

const transitions: Record<ControlOwner, ControlOwner[]> = {
  AUTOMATION_RUNNING: ['INTERVENTION_REQUESTED', 'COMPLETED', 'FAILED'],
  INTERVENTION_REQUESTED: ['AUTOMATION_PAUSED'],
  AUTOMATION_PAUSED: ['HUMAN_CONTROL'],
  HUMAN_CONTROL: ['RESUME_REQUESTED', 'COMPLETED', 'FAILED'],
  RESUME_REQUESTED: ['AUTOMATION_RUNNING'],
  COMPLETED: [],
  FAILED: [],
};
export interface Operator {
  intervene(request: InterventionRequest, page: Page): Promise<'resume' | 'complete' | 'abort'>;
}
export class HandoffController extends EventEmitter {
  owner: ControlOwner = 'AUTOMATION_RUNNING';
  readonly humanActions: { at: string; kind: string; target: string }[] = [];
  constructor(
    readonly context: BrowserContext,
    readonly page: Page,
  ) {
    super();
  }
  transition(next: ControlOwner): void {
    if (!transitions[this.owner].includes(next))
      throw new Error(`Invalid transition ${this.owner} -> ${next}`);
    this.owner = next;
    this.emit('transition', next);
  }
  async handoff(
    request: InterventionRequest,
    operator: Operator,
  ): Promise<'resume' | 'complete' | 'abort'> {
    this.transition('INTERVENTION_REQUESTED');
    this.transition('AUTOMATION_PAUSED');
    this.transition('HUMAN_CONTROL');
    const listener = (data: { type: string; selector?: string }) =>
      this.humanActions.push({
        at: new Date().toISOString(),
        kind: data.type,
        target: data.selector ? '[REDACTED_TARGET]' : 'page',
      });
    await this.page.exposeFunction('__recordHumanAction', listener).catch(() => {});
    const installRecorder = () =>
      document.addEventListener('click', (e) => {
        void (
          globalThis as unknown as { __recordHumanAction: (x: unknown) => void }
        ).__recordHumanAction({ type: 'click', selector: (e.target as HTMLElement).tagName });
      });
    await this.context.addInitScript(installRecorder);
    await this.page.evaluate(installRecorder);
    const decision = await operator.intervene({ ...request, owner: this.owner }, this.page);
    if (decision === 'resume') {
      this.transition('RESUME_REQUESTED');
      this.transition('AUTOMATION_RUNNING');
    } else this.transition(decision === 'complete' ? 'COMPLETED' : 'FAILED');
    return decision;
  }
}
