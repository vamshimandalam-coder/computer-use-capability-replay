import { describe, expect, it } from 'vitest';
import { CapabilitySchema } from '../../src/domain/artifact.js';
import { savingsCapability } from '../../src/artifacts/sample.js';
import { PolicyEngine } from '../../src/policy/policy.js';
import { redact } from '../../src/observability/redact.js';
import { HandoffController } from '../../src/escalation/handoff.js';
import { safePath } from '../../src/artifacts/io.js';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../schemas/capability.schema.json' with { type: 'json' };
const AjvConstructor = Ajv2020 as unknown as new (options: { strict: boolean }) => {
  compile(value: unknown): ((data: unknown) => boolean) & { errors?: unknown };
};
describe('capability contract', () => {
  it('validates the reviewable sample', () =>
    expect(CapabilitySchema.parse(savingsCapability).schemaVersion).toBe('1.0'));
  it('rejects unknown schema versions', () =>
    expect(() => CapabilitySchema.parse({ ...savingsCapability, schemaVersion: '2.0' })).toThrow());
  it('passes the complete portable JSON Schema', () => {
    const validate = new AjvConstructor({ strict: true }).compile(schema);
    expect(validate(savingsCapability), JSON.stringify(validate.errors)).toBe(true);
  });
});
describe('safety', () => {
  it('blocks routes outside the allowlist', () =>
    expect(() =>
      new PolicyEngine({
        origins: ['http://safe'],
        routes: [/^\/$/],
        actions: ['click'],
        allowReversible: false,
        approvedRisky: false,
      }).checkUrl('http://evil/'),
    ).toThrow('Blocked route'));
  it('recursively redacts identifiers and tokens', () =>
    expect(redact({ memberId: '10001', nested: { token: 'secret' }, ok: 'yes' })).toEqual({
      memberId: '[REDACTED]',
      nested: { token: '[REDACTED]' },
      ok: 'yes',
    }));
  it('blocks path traversal', () =>
    expect(() => safePath('evidence', '../outside.json')).toThrow('Path traversal blocked'));
  it('blocks irreversible actions regardless of approval', () => {
    const policy = new PolicyEngine({
      origins: ['http://safe'],
      routes: [/^\/$/],
      actions: ['click'],
      allowReversible: true,
      approvedRisky: true,
    });
    expect(() =>
      policy.checkAction({
        id: 'delete',
        action: 'click',
        risk: 'irreversible',
        waitMs: 1000,
      }),
    ).toThrow('delete');
  });
});
describe('control ownership', () => {
  it('rejects two-controller shortcuts', () => {
    const h = new HandoffController({} as never, {} as never);
    expect(() => h.transition('HUMAN_CONTROL')).toThrow('Invalid transition');
  });
});
