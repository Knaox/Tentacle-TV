#!/usr/bin/env node
/**
 * Enregistreur du banc wt-bureau : une connexion CDP tenue sur la page de l'app
 * (Electron 9741, Chrome 9742), qui écrit en JSONL, à l'heure murale du Mac
 * (commune aux deux clients) :
 *  - les trames `wt:*` de la socket (sens, type, extrait) ;
 *  - les journaux `[WT…]` de la console ;
 *  - toutes les 200 ms la lecture : position et pause (la `<video>` du web, mpv
 *    du bureau par le pont `window.tentacle`), la route, et les textes d'avis
 *    (`role=status|alert`, toasts) quand ils changent.
 *
 *   node record.mjs <port> <fichier.jsonl>      # tourne jusqu'à SIGTERM
 */

import { appendFileSync } from "node:fs";

const [port, out] = process.argv.slice(2);
const write = (entry) => appendFileSync(out, `${JSON.stringify({ at: Date.now(), ...entry })}\n`);

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page" && /^(tentacle|https?):/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Network.webSocketFrameReceived" || msg.method === "Network.webSocketFrameSent") {
    const text = msg.params.response?.payloadData ?? "";
    if (!text.includes("\"wt:")) return;
    let type = "?";
    try { type = JSON.parse(text).type; } catch { /* trame non JSON */ }
    write({ kind: msg.method.endsWith("Received") ? "in" : "out", type, raw: text.slice(0, 8000) });
  } else if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ");
    if (/\[WT|watch|wt:/i.test(text)) write({ kind: "console", text: text.slice(0, 600) });
  }
};

await send("Network.enable");
await send("Runtime.enable");

const SAMPLE = `(async () => {
  const v = document.querySelector("video");
  let pos = null, paused = null, src = "none";
  if (window.tentacle?.invoke && /\\/watch/.test(location.pathname)) {
    try {
      pos = await window.tentacle.invoke("mpv_get_property", { name: "time-pos", format: "double" });
      paused = await window.tentacle.invoke("mpv_get_property", { name: "pause", format: "flag" });
      src = "mpv";
    } catch { src = "mpv-err"; }
  } else if (v) { pos = v.currentTime; paused = v.paused; src = "video"; }
  const notes = [...document.querySelectorAll('[role=status],[role=alert],[data-sonner-toast],.toast,[class*="toast"]')]
    .map((n) => n.innerText.trim()).filter(Boolean).join(" ¦ ").slice(0, 400);
  // Les messages de Watch Together, où qu'ils s'affichent (voile du lecteur, avis, bande de l'accueil).
  const msgs = [...new Set((document.body.innerText.match(/[^\\n]*(rejoint la lecture|rejoint le groupe|n'a pas rejoint|a quitté la lecture|a quitté le groupe|En attente de|est maintenant l'hôte|ne peut pas lire)[^\\n]*/g) ?? []))].join(" ¦ ").slice(0, 400);
  return { route: location.pathname + location.search, pos, paused, src, notes, msgs };
})()`;

let lastNotes = "";
let lastRoute = "";
let lastMsgs = "";
setInterval(async () => {
  const res = await send("Runtime.evaluate", { expression: SAMPLE, awaitPromise: true, returnByValue: true });
  const s = res.result?.result?.value;
  if (!s) return;
  if (s.notes !== lastNotes) { lastNotes = s.notes; write({ kind: "notes", text: s.notes }); }
  if (s.msgs !== lastMsgs) { lastMsgs = s.msgs; write({ kind: "msgs", text: s.msgs }); }
  if (s.route !== lastRoute) { lastRoute = s.route; write({ kind: "route", route: s.route }); }
  if (s.src !== "none") write({ kind: "sample", pos: s.pos, paused: s.paused, src: s.src });
}, 200);
