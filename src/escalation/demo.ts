import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { HandoffController, type Operator } from './handoff.js';

export async function demonstrateHandoff(target: string, evidenceDir: string): Promise<void> {
  await mkdir(evidenceDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(target);
  await context.addCookies([{ name: 'session-id', value: 'synthetic-session', url: target }]);
  const before = (await context.cookies()).find((c) => c.name === 'session-id')?.value;
  const handoff = new HandoffController(context, page);
  const states = [handoff.owner];
  handoff.on('transition', (state) => states.push(state));
  const operator: Operator = {
    async intervene(_request, livePage) {
      await livePage.getByLabel('Member number').fill('10001');
      await livePage.getByRole('button', { name: 'Search members' }).click();
      return 'resume';
    },
  };
  const screenshot = `${evidenceDir}/handoff.png`;
  await page.screenshot({ path: screenshot });
  await handoff.handoff(
    {
      runId: 'handoff-demo',
      capability: 'heritage.read-savings-balance',
      stepId: 'search',
      reason: 'Demonstrate operator control transfer',
      url: page.url(),
      observation: 'Synthetic member inquiry page',
      screenshot,
      risk: 'safe',
      requestedAction: 'Perform the member search and resume',
      owner: handoff.owner,
    },
    operator,
  );
  const after = (await context.cookies()).find((c) => c.name === 'session-id')?.value;
  await writeFile(
    `${evidenceDir}/run.json`,
    JSON.stringify(
      {
        sessionPreserved: before === after,
        states,
        humanActions: handoff.humanActions,
        finalUrl: page.url(),
      },
      null,
      2,
    ),
  );
  await browser.close();
}
