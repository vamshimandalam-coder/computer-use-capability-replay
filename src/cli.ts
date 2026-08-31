import { Command } from 'commander';
import { resolve } from 'node:path';
import { discover } from './agent/discovery.js';
import { OpenAIPlanner, ScriptedPlanner } from './agent/planner.js';
import { loadCapability, saveCapability } from './artifacts/io.js';
import { savingsCapability } from './artifacts/sample.js';
import { replay } from './replay/replay.js';
import { demonstrateHandoff } from './escalation/demo.js';
import { DEFAULT_TARGET_URL } from './config/heritage.js';
const cli = new Command().name('computer-use');
cli
  .command('seed-artifact')
  .option('--out <path>', 'output', 'evidence/artifacts/read-savings.json')
  .action(async (o) => saveCapability(resolve(o.out), savingsCapability));
cli
  .command('discover')
  .requiredOption('--goal <text>')
  .option('--target <url>', 'target', DEFAULT_TARGET_URL)
  .requiredOption('--member-id <id>')
  .option('--provider <name>', 'openai or scripted', 'openai')
  .option('--max-steps <n>', 'step limit', '8')
  .option('--timeout-ms <n>', 'timeout', '60000')
  .option('--evidence <dir>', 'directory', 'runtime-evidence/discovery')
  .option('--artifact <path>', 'artifact', 'runtime-evidence/artifacts/read-savings.json')
  .action(async (o) => {
    const planner = o.provider === 'scripted' ? new ScriptedPlanner() : new OpenAIPlanner();
    await discover({
      goal: o.goal,
      target: o.target,
      inputs: { memberId: o.memberId },
      planner,
      maxSteps: Number(o.maxSteps),
      timeoutMs: Number(o.timeoutMs),
      evidenceDir: resolve(o.evidence),
      artifactPath: resolve(o.artifact),
    });
    console.log(JSON.stringify({ status: 'success', artifact: resolve(o.artifact) }));
  });
cli
  .command('replay')
  .option('--artifact <path>', 'artifact', 'evidence/artifacts/read-savings.json')
  .requiredOption('--member-id <id>')
  .option('--evidence <dir>', 'directory', 'runtime-evidence/replay')
  .action(async (o) => {
    const result = await replay(
      await loadCapability(resolve(o.artifact)),
      { memberId: o.memberId },
      resolve(o.evidence),
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'failure') process.exitCode = 1;
  });
cli
  .command('handoff-demo')
  .option('--target <url>', 'target', DEFAULT_TARGET_URL)
  .option('--evidence <dir>', 'directory', 'runtime-evidence/handoff')
  .action(async (o) => {
    await demonstrateHandoff(o.target, resolve(o.evidence));
    console.log(JSON.stringify({ status: 'success', evidence: resolve(o.evidence) }));
  });
cli
  .command('replay-handoff-demo')
  .option('--artifact <path>', 'artifact', 'evidence/artifacts/read-savings.json')
  .option('--evidence <dir>', 'directory', 'runtime-evidence/replay-handoff')
  .action(async (o) => {
    const result = await replay(
      await loadCapability(resolve(o.artifact)),
      { memberId: '99999' },
      resolve(o.evidence),
      {
        operator: {
          async intervene(_request, page) {
            await page.goto(DEFAULT_TARGET_URL);
            await page.getByLabel('Member number').fill('10002');
            await page.getByRole('button', { name: 'Search members' }).click();
            await page.getByRole('link', { name: 'Continue' }).click();
            await page.getByRole('link', { name: 'Open member record' }).click();
            await page.getByRole('link', { name: 'Savings account' }).click();
            return 'resume';
          },
        },
      },
    );
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'failure') process.exitCode = 1;
  });
await cli.parseAsync();
