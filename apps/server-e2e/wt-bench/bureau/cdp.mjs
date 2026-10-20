#!/usr/bin/env node
/**
 * Pilote CDP minimal du banc wt-bureau — l'Electron jetable (9741) et le Chrome
 * jetable (9742). La page visée est celle de l'app : `tentacle://` ou `http(s)://`.
 *
 *   node cdp.mjs <port> eval '<expression JS>'   # REPL : la dernière valeur, en JSON
 *   node cdp.mjs <port> shot <fichier.png>
 *   node cdp.mjs <port> key <touche>              # Escape, Space, ArrowRight…
 */

const [port, command, arg] = process.argv.slice(2);
const keepAlive = setInterval(() => {}, 1000);

const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((t) => t.type === "page" && /^(tentacle|https?):/.test(t.url));
if (!page) throw new Error(`aucune page de l'app sur ${port}`);
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) => new Promise((resolve) => {
  const id = nextId++;
  pending.set(id, resolve);
  ws.send(JSON.stringify({ id, method, params }));
});

const KEYS = {
  Escape: { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 },
  Space: { key: " ", code: "Space", windowsVirtualKeyCode: 32 },
  ArrowRight: { key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 },
  ArrowLeft: { key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 },
  Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
};

if (command === "eval") {
  const res = await send("Runtime.evaluate", { expression: arg, awaitPromise: true, returnByValue: true, replMode: true, userGesture: true });
  const r = res.result;
  if (r?.exceptionDetails) console.log("EXCEPTION", JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  else console.log(typeof r?.result?.value === "string" ? r.result.value : JSON.stringify(r?.result?.value ?? null, null, 1));
} else if (command === "shot") {
  await send("Page.bringToFront");
  const res = await send("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(arg, Buffer.from(res.result.data, "base64"));
  console.log(arg);
} else if (command === "key") {
  const k = KEYS[arg] ?? { key: arg };
  await send("Input.dispatchKeyEvent", { type: "keyDown", ...k });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
  console.log("ok");
}
ws.close();
clearInterval(keepAlive);
