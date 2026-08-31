import type { PolicyConfig } from '../policy/policy.js';

export const DEFAULT_TARGET_URL = 'http://127.0.0.1:4317/';

const discoveryRoutes = [/^\/$/, /^\/search$/, /^\/member\/\d+(\/savings)?$/];
const replayRoutes = [...discoveryRoutes, /^\/resume\/\d+$/];

export function heritagePolicyConfig(
  targetUrl = DEFAULT_TARGET_URL,
  mode: 'discovery' | 'replay' = 'replay',
): PolicyConfig {
  const discovery = mode === 'discovery';
  return {
    origins: [new URL(targetUrl).origin],
    routes: discovery ? discoveryRoutes : replayRoutes,
    actions: discovery ? ['navigate', 'fill', 'click'] : ['navigate', 'fill', 'click', 'select'],
    allowReversible: !discovery,
    approvedRisky: false,
  };
}
