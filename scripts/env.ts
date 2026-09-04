const [command = 'inspect', argument] = process.argv.slice(2);
const base = process.env.MOTION_ARENA_URL ?? 'http://localhost:5173';
const parse = () => argument && command !== 'reward' ? JSON.parse(argument) as Record<string, unknown> : {};
const routes: Record<string, { method: string; path: string; body?: Record<string, unknown> }> = {
  inspect: { method: 'GET', path: '/env/inspect' },
  rollout: { method: 'POST', path: '/env/rollout', body: parse() },
  refine: { method: 'POST', path: '/env/refine', body: parse() },
  submit: { method: 'POST', path: '/env/submit', body: parse() },
  reset: { method: 'POST', path: '/env/reset', body: {} },
};
const route = command === 'reward'
  ? { method: 'GET', path: `/env/reward/${encodeURIComponent(argument ?? '')}` }
  : routes[command];
if (!route) throw new Error(`Unknown command: ${command}`);
const response = await fetch(`${base}${route.path}`, {
  method: route.method,
  headers: route.body ? { 'content-type': 'application/json' } : undefined,
  body: route.body ? JSON.stringify(route.body) : undefined,
});
console.log(await response.text());
if (!response.ok) process.exitCode = 1;
