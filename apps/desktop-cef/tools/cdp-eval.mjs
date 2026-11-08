#!/usr/bin/env node
// Évalue une expression JS dans la page via les DevTools distants de CEF (Node ≥ 22).
// Usage : node tools/cdp-eval.mjs <port> '<expression>'   (les promesses sont attendues)
// Ex.   : node tools/cdp-eval.mjs 9301 "__shell.invoke('shell.stats')"
const [port = '9301', expr = 'document.title'] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('aucune page sur le port', port); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate',
  params: { expression: expr, awaitPromise: true, returnByValue: true } }));
const msg = await new Promise((ok) => { ws.onmessage = (m) => ok(JSON.parse(m.data)); });
ws.close();
const r = msg.result || {};
if (r.exceptionDetails) {
  console.error('exception :', r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  process.exit(1);
}
console.log(JSON.stringify(r.result?.value ?? r.result, null, 1));
