import type { Page } from '@playwright/test';
import type { Capability } from '../domain/artifact.js';

export interface PolicyConfig {
  origins: string[];
  routes: RegExp[];
  actions: Capability['steps'][number]['action'][];
  allowReversible: boolean;
  approvedRisky: boolean;
}
export class PolicyError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export class PolicyEngine {
  constructor(private readonly config: PolicyConfig) {}
  checkUrl(raw: string): void {
    const url = new URL(raw);
    if (
      !this.config.origins.includes(url.origin) ||
      !this.config.routes.some((r) => r.test(url.pathname))
    )
      throw new PolicyError('ROUTE_NOT_ALLOWED', `Blocked route ${url.origin}${url.pathname}`);
  }
  checkAction(step: Capability['steps'][number]): void {
    if (!this.config.actions.includes(step.action))
      throw new PolicyError('ACTION_NOT_ALLOWED', step.action);
    if (step.risk === 'irreversible') throw new PolicyError('IRREVERSIBLE_BLOCKED', step.id);
    if (step.risk === 'risky' && !this.config.approvedRisky)
      throw new PolicyError('HUMAN_APPROVAL_REQUIRED', step.id);
    if (step.risk === 'reversible' && !this.config.allowReversible)
      throw new PolicyError('REVERSIBLE_NOT_ALLOWED', step.id);
  }
  async enforcePage(page: Page): Promise<void> {
    this.checkUrl(page.url());
  }
}
