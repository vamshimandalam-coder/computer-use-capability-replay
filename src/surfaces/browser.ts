import { type BrowserContext, type Locator, type Page } from '@playwright/test';
import { relative } from 'node:path';
import type { Capability, LocatorSpec } from '../domain/artifact.js';

export interface Observation {
  url: string;
  title: string;
  text: string;
  controls: { ref: string; role: string; name: string; state: 'empty' | 'filled' | 'n/a' }[];
  screenshot: string;
}
export class SurfaceFailure extends Error {
  constructor(
    public readonly code: 'AMBIGUOUS_CONTROL' | 'CONTROL_NOT_FOUND' | 'CHECKPOINT_MISMATCH',
    message: string,
  ) {
    super(message);
  }
}
export class BrowserSurface {
  constructor(
    readonly context: BrowserContext,
    readonly page: Page,
    readonly evidenceDir: string,
  ) {}
  async observe(name: string): Promise<Observation> {
    const screenshot = `${this.evidenceDir}/${name}.png`;
    await this.page.screenshot({ path: screenshot, fullPage: true });
    const controls = await this.page.locator('a,button,input,select,textarea').evaluateAll((els) =>
      els
        .filter((e) => {
          const x = e as HTMLElement;
          return !!(x.offsetWidth || x.offsetHeight);
        })
        .map((e, i) => {
          const x = e as HTMLInputElement;
          return {
            ref: `c${i}`,
            role: e.tagName.toLowerCase(),
            name:
              x.getAttribute('aria-label') ||
              x.labels?.[0]?.textContent?.trim() ||
              x.innerText?.trim() ||
              x.value ||
              x.name ||
              '',
            state: (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT'
              ? x.value
                ? 'filled'
                : 'empty'
              : 'n/a') as 'empty' | 'filled' | 'n/a',
          };
        }),
    );
    return {
      url: this.page.url(),
      title: await this.page.title(),
      text: (await this.page.locator('body').innerText()).slice(0, 4000),
      controls,
      screenshot: relative(process.cwd(), screenshot).replaceAll('\\', '/'),
    };
  }
  private candidate(spec: LocatorSpec): Locator {
    switch (spec.kind) {
      case 'role':
        return this.page.getByRole(spec.role as never, { name: spec.name });
      case 'label':
        return this.page.getByLabel(spec.label);
      case 'text':
        return this.page.getByText(spec.text, { exact: spec.exact });
      case 'attribute':
        return this.page.locator(`[${spec.name}=${JSON.stringify(spec.value)}]`);
      case 'css':
        return this.page.locator(spec.selector);
    }
  }
  async resolve(
    target: NonNullable<Capability['steps'][number]['target']>,
  ): Promise<{ locator: Locator; strategy: string }> {
    for (const spec of target.locators) {
      const loc = this.candidate(spec);
      const n = await loc.count();
      if (n === 1 && (await loc.isVisible())) return { locator: loc, strategy: spec.kind };
      if (n > 1)
        throw new SurfaceFailure(
          'AMBIGUOUS_CONTROL',
          `${target.description} matched ${n} via ${spec.kind}`,
        );
    }
    throw new SurfaceFailure('CONTROL_NOT_FOUND', target.description);
  }
  async execute(
    step: Capability['steps'][number],
    inputs: Record<string, unknown>,
  ): Promise<string> {
    if (step.action === 'navigate') {
      const value = resolveValue(step.value, inputs);
      await this.page.goto(value, { waitUntil: 'domcontentloaded', timeout: step.waitMs });
      return 'url';
    }
    if (!step.target) throw new SurfaceFailure('CONTROL_NOT_FOUND', `${step.id} lacks target`);
    const { locator, strategy } = await this.resolve(step.target);
    if (step.action === 'click') await locator.click({ timeout: step.waitMs });
    if (step.action === 'fill')
      await locator.fill(resolveValue(step.value, inputs), { timeout: step.waitMs });
    if (step.action === 'select')
      await locator.selectOption(resolveValue(step.value, inputs), { timeout: step.waitMs });
    return strategy;
  }
  async checkpoint(c: Capability['success']): Promise<boolean> {
    if (c.kind === 'url') return new URL(this.page.url()).pathname === c.expected;
    if (c.kind === 'visibleText')
      return this.page
        .getByText(c.expected, { exact: false })
        .first()
        .isVisible()
        .catch(() => false);
    return this.page
      .locator(c.expected)
      .first()
      .isVisible()
      .catch(() => false);
  }
  async extract(def: Capability['outputs'][string]): Promise<unknown> {
    const { locator } = await this.resolve(def.target);
    const raw = (await locator.innerText()).trim();
    if (def.transform === 'currency') return Number(raw.replace(/[^0-9.-]/g, ''));
    if (def.transform === 'boolean') return /^(true|yes|active)$/i.test(raw);
    return raw;
  }
}
function resolveValue(
  value: Capability['steps'][number]['value'],
  inputs: Record<string, unknown>,
): string {
  if (!value) throw new Error('Missing step value');
  const x = value.source === 'literal' ? value.value : inputs[value.key];
  if (typeof x !== 'string') throw new Error('Value must be a string');
  return x;
}
