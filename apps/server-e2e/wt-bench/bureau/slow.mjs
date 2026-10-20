#!/usr/bin/env node
/**
 * Arrivant LENT (banc wt-bureau) : retient `delayMs` les requêtes de lecture
 * (PlaybackInfo, flux, HLS) de la page tenue par CDP, pendant `seconds` — le
 * chargement d'un téléphone sur un réseau moyen, rejoué au bureau.
 *
 *   node slow.mjs <port> <delayMs> <seconds>
 */

const [port, delayS, secondsS] = process.argv.slice(2);
const delayMs = Number(delayS);
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page" && /^(tentacle|https?):/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let id = 1;
const send = (method, params = {}) => ws.send(JSON.stringify({ id: id++, method, params }));
let held = 0;
ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.method !== "Fetch.requestPaused") return;
  held += 1;
  console.log(`${Date.now()} retenue ${delayMs} ms : ${msg.params.request.url.replace(/api_key=[^&]+/, "api_key=…").slice(0, 140)}`);
  setTimeout(() => send("Fetch.continueRequest", { requestId: msg.params.requestId }), delayMs);
};
send("Fetch.enable", {
  patterns: ["*PlaybackInfo*", "*/Videos/*", "*master.m3u8*", "*/hls1/*", "*/stream*"].map((urlPattern) => ({ urlPattern, requestStage: "Request" })),
});
setTimeout(() => {
  console.log(`fin — ${held} requêtes retenues`);
  ws.close();
  process.exit(0);
}, Number(secondsS) * 1000);
