import { z } from 'zod';

export const LocatorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('role'), role: z.string(), name: z.string() }),
  z.object({ kind: z.literal('label'), label: z.string() }),
  z.object({ kind: z.literal('text'), text: z.string(), exact: z.boolean().default(true) }),
  z.object({ kind: z.literal('attribute'), name: z.string(), value: z.string() }),
  z.object({ kind: z.literal('css'), selector: z.string() }),
]);
export type LocatorSpec = z.infer<typeof LocatorSchema>;

const TargetSchema = z.object({
  surface: z.literal('browser'),
  description: z.string(),
  framePath: z.array(z.string()).default([]),
  locators: z.array(LocatorSchema).min(1),
});
const ValueSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('literal'), value: z.string() }),
  z.object({ source: z.literal('input'), key: z.string() }),
]);
const CheckpointSchema = z.object({
  kind: z.enum(['url', 'visibleText', 'elementVisible']),
  expected: z.string(),
});
const StepSchema = z.object({
  id: z.string(),
  action: z.enum(['navigate', 'click', 'fill', 'select']),
  target: TargetSchema.optional(),
  value: ValueSchema.optional(),
  risk: z.enum(['safe', 'reversible', 'risky', 'irreversible']),
  waitMs: z.number().int().positive().max(15_000).default(5_000),
  checkpoint: CheckpointSchema.optional(),
});
const FieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean(),
  pattern: z.string().optional(),
  description: z.string(),
  sensitive: z.boolean().default(false),
});
const OutputSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string(),
  target: TargetSchema,
  transform: z.enum(['text', 'currency', 'boolean']).default('text'),
});
export const CapabilitySchema = z.object({
  schemaVersion: z.literal('1.0'),
  capability: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
    description: z.string(),
    lifecycle: z.enum(['draft', 'approved']),
  }),
  compatibility: z.object({
    surface: z.literal('browser'),
    application: z.string(),
    vendor: z.string(),
    versions: z.array(z.string()),
    tenantOverrides: z.record(z.string(), z.unknown()).default({}),
  }),
  inputs: z.record(z.string(), FieldSchema),
  outputs: z.record(z.string(), OutputSchema),
  preconditions: z.array(CheckpointSchema),
  steps: z.array(StepSchema).min(1),
  businessOutcomes: z.array(z.object({ code: z.string(), when: CheckpointSchema })),
  recoveries: z.array(
    z.object({
      code: z.string(),
      when: CheckpointSchema,
      action: StepSchema,
      maxAttempts: z.number().int().min(1).max(3),
    }),
  ),
  escalation: z.object({ on: z.array(z.string()), requestedAction: z.string() }),
  success: CheckpointSchema,
  redaction: z.object({ inputKeys: z.array(z.string()), outputKeys: z.array(z.string()) }),
});
export type Capability = z.infer<typeof CapabilitySchema>;

export type RunResult =
  | {
      status: 'success';
      runId: string;
      capability: string;
      outputs: Record<string, unknown>;
      completedStep: string;
      durationMs: number;
      evidence: string[];
      modelCalls: 0;
    }
  | {
      status: 'business_outcome';
      runId: string;
      code: string;
      details: string;
      evidence: string[];
      modelCalls: 0;
    }
  | {
      status: 'failure';
      runId: string;
      category:
        | 'input'
        | 'policy'
        | 'surface'
        | 'checkpoint'
        | 'permission'
        | 'timeout'
        | 'ambiguous';
      code: string;
      stepId: string;
      expected: string;
      observed: string;
      retryable: boolean;
      evidence: string[];
      escalation?: InterventionRequest;
      modelCalls: 0;
    };

export interface InterventionRequest {
  runId: string;
  capability: string;
  stepId: string;
  reason: string;
  url: string;
  observation: string;
  screenshot: string;
  risk: string;
  requestedAction: string;
  owner: ControlOwner;
}
export type ControlOwner =
  | 'AUTOMATION_RUNNING'
  | 'INTERVENTION_REQUESTED'
  | 'AUTOMATION_PAUSED'
  | 'HUMAN_CONTROL'
  | 'RESUME_REQUESTED'
  | 'COMPLETED'
  | 'FAILED';
