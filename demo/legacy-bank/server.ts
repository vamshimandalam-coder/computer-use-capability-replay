import express from 'express';
import type { Server } from 'node:http';
export const app = express();
app.use(express.urlencoded({ extended: false }));
const members: Record<string, { name: string; balance: string }> = {
  '10001': { name: 'Avery Sample', balance: '$4,812.37' },
  '10002': { name: 'Jordan Example', balance: '$923.10' },
};
const shell = (body: string) =>
  `<!doctype html><html><head><title>Heritage CU Operator</title><style>body{font:16px Georgia;background:#e8e3d6;margin:0}.bar{background:#17324d;color:white;padding:16px}main{margin:30px auto;width:760px;background:#fff;padding:24px;border:3px double #17324d}table{border-collapse:collapse;width:100%}td,th{border:1px solid #777;padding:10px}label{display:block;margin:12px 0}button,a{margin:8px;padding:7px}</style></head><body><div class="bar">HERITAGE CREDIT UNION — MEMBER SERVICES</div><main>${body}</main></body></html>`;
const searchResults = (id: string, name: string) =>
  shell(
    `<h1>Search results</h1><table><tr><th>Member</th><th>Name</th><th>Action</th></tr><tr><td>${id}</td><td>${name}</td><td><a href="/member/${id}">Open member record</a></td></tr></table>`,
  );
app.get('/', (_q, r) =>
  r.send(
    shell(
      `<h1>Member inquiry</h1><form method="post" action="/search"><label>Member number <input name="member" autocomplete="off"></label><button type="submit">Search members</button></form>`,
    ),
  ),
);
app.post('/search', (q, r) => {
  const id = String(q.body.member ?? '');
  if (id === '99999')
    return r
      .status(403)
      .send(shell('<h1>Permission denied</h1><p>Your role cannot access this member.</p>'));
  const m = members[id];
  if (!m)
    return r.send(shell('<h1>Search results</h1><p>No member found</p><a href="/">New search</a>'));
  if (id === '10002')
    return r.send(
      shell(
        `<h1>Temporary service notice</h1><p>A known interstitial interrupted the search.</p><a href="/resume/${id}">Continue</a>`,
      ),
    );
  return r.send(searchResults(id, m.name));
});
app.get('/resume/:id', (q, r) => {
  const m = members[q.params.id];
  if (!m) return r.status(404).send(shell('<h1>Application error</h1>'));
  return r.send(searchResults(q.params.id, m.name));
});
app.get('/member/:id', (q, r) => {
  const m = members[q.params.id];
  if (!m) return r.status(404).send(shell('<h1>Application error</h1>'));
  r.send(
    shell(
      `<h1>Member record</h1><p>${m.name}</p><nav><a href="/member/${q.params.id}/savings">Savings account</a></nav>`,
    ),
  );
});
app.get('/member/:id/savings', (q, r) => {
  const m = members[q.params.id];
  if (!m) return r.status(404).send(shell('<h1>Application error</h1>'));
  r.send(
    shell(
      `<h1>Savings account</h1><table><tr><th>Current savings balance</th><td class="balance">${m.balance}</td></tr></table><button onclick="document.querySelector('#risky').hidden=false">Close account</button><p id="risky" hidden>Final irreversible action requires supervisor approval.</p>`,
    ),
  );
});
export function startLegacyBank(
  port = Number(process.env.PORT ?? 4317),
  ready?: () => void,
): Server {
  return app.listen(port, '127.0.0.1', () => {
    console.log(`legacy-bank http://127.0.0.1:${port}`);
    ready?.();
  });
}
if (process.argv[1] && /legacy-bank[\\/]server\.(ts|js)$/.test(process.argv[1])) startLegacyBank();
