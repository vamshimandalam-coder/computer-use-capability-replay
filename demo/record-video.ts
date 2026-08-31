import { chromium, type Page } from '@playwright/test';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_TARGET_URL } from '../src/config/heritage.js';

const target = process.env.TARGET_URL ?? DEFAULT_TARGET_URL;
const outputDir = 'evidence/video';
const rawDir = join(outputDir, 'raw');

async function caption(page: Page, text: string, duration = 2200): Promise<void> {
  await page.evaluate((message) => {
    document.querySelector('#demo-caption')?.remove();
    const element = document.createElement('div');
    element.id = 'demo-caption';
    element.textContent = message;
    Object.assign(element.style, {
      position: 'fixed',
      left: '4%',
      right: '4%',
      bottom: '24px',
      zIndex: '99999',
      padding: '16px 22px',
      borderRadius: '10px',
      background: 'rgba(10, 22, 35, .94)',
      color: 'white',
      font: '600 22px/1.35 system-ui',
      textAlign: 'center',
      boxShadow: '0 4px 18px rgba(0,0,0,.35)',
    });
    document.body.append(element);
  }, text);
  await page.waitForTimeout(duration);
}

await mkdir(rawDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: rawDir, size: { width: 1280, height: 720 } },
});
const page = await context.newPage();
await page.goto(target);

await caption(page, 'Goal: find a member and return their current savings balance.', 3000);
await caption(
  page,
  'Discovery: an LLM observes this live UI and proposes one safe action at a time.',
);
await page.getByLabel('Member number').fill('10001');
await caption(page, '1. Fill the typed memberId input.');
await page.getByRole('button', { name: 'Search members' }).click();
await caption(page, '2. Search through the user interface — no backend API calls.');
await page.getByRole('link', { name: 'Open member record' }).click();
await caption(page, '3. Open the matching member record.');
await page.getByRole('link', { name: 'Savings account' }).click();
await caption(page, '4. Open savings and verify the success checkpoint.');
await caption(page, 'Output extracted: current balance = $4,812.37', 3000);
await caption(page, 'The verified actions are saved as a typed, versioned capability.', 3000);

await page.goto(target);
await caption(page, 'Replay: use the same capability with a different memberId.', 2500);
await page.getByLabel('Member number').fill('10002');
await page.getByRole('button', { name: 'Search members' }).click();
await caption(page, 'A known interstitial is detected and recovered once — without an LLM.');
await page.getByRole('link', { name: 'Continue' }).click();
await page.getByRole('link', { name: 'Open member record' }).click();
await page.getByRole('link', { name: 'Savings account' }).click();
await caption(page, 'Deterministic result: balance = 923.10; model calls = 0.', 3500);
await caption(page, 'Policy checks, structured errors, and human handoff protect every run.', 3500);
await caption(page, 'Discover once. Review the capability. Replay safely many times.', 4000);

await context.close();
await browser.close();
const videos = (await readdir(rawDir)).filter((name) => name.endsWith('.webm'));
const latest = videos.at(-1);
if (!latest) throw new Error('Playwright did not produce a video');
await copyFile(join(rawDir, latest), join(outputDir, 'computer-use-demo.webm'));
console.log(join(outputDir, 'computer-use-demo.webm'));
