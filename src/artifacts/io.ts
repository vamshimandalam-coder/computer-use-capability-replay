import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { CapabilitySchema, type Capability } from '../domain/artifact.js';
export async function loadCapability(path: string): Promise<Capability> {
  return CapabilitySchema.parse(JSON.parse(await readFile(path, 'utf8')));
}
export async function saveCapability(path: string, value: unknown): Promise<void> {
  const cap = CapabilitySchema.parse(value);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(cap, null, 2) + '\n');
}
export function safePath(root: string, path: string): string {
  const r = resolve(root),
    p = resolve(root, path);
  if (relative(r, p).startsWith('..')) throw new Error('Path traversal blocked');
  return p;
}
