#!/usr/bin/env node
/**
 * Coupure réseau (banc wt-bureau) : dans UNE session CDP, exécute un geste de
 * la page (`expression`, ex. cliquer « Accepter »), puis coupe le réseau de la
 * page (requêtes ET socket) pendant `seconds`, et le rend. Imprime l'heure du
 * geste et celle de la coupure.
 *
 *   node offline.mjs <port> <seconds> '<expression JS du geste>'
 */

const [port, secondsS, expression] = process.argv.slice(2);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page" && /^(tentacle|https?):/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

await send("Network.enable");
const gestureAt = Date.now();
const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const offAt = Date.now();
console.log(`geste ${gestureAt} (${JSON.stringify(res.result?.result?.value ?? null)}), coupure ${offAt}`);
await new Promise((resolve) => setTimeout(resolve, Number(secondsS) * 1000));
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
console.log(`réseau rendu ${Date.now()}`);
ws.close();
process.exit(0);
