#!/usr/bin/env node
// Touches et texte par CDP : node tests/recette/keys.mjs <port> '<json>'
// json : [{key, code, modifiers?, text?} | {insertText:"…"} | {waitMs}]  (modifiers : 2 Ctrl, 4 ⌘, 8 Maj)
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";
const [port = "9425", json = "[]"] = process.argv.slice(2);
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
for (const ev of JSON.parse(json)) {
  if (ev.waitMs) await new Promise((r) => setTimeout(r, ev.waitMs));
  else if (ev.insertText !== undefined) await cdp.send("Input.insertText", { text: ev.insertText });
  else {
    const base = { key: ev.key, code: ev.code, modifiers: ev.modifiers ?? 0, windowsVirtualKeyCode: ev.vk ?? 0 };
    await cdp.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...base });
    if (ev.text) await cdp.send("Input.dispatchKeyEvent", { type: "char", text: ev.text, ...base });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", ...base });
  }
}
cdp.close();
