#!/usr/bin/env node
// Suite d'évènements souris CDP : node tests/recette/mouse.mjs <port> '<json>'
// json : [{type:"mousePressed"|"mouseMoved"|"mouseReleased", x, y, button?, buttons?, modifiers?, waitMs?}…]
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";
const [port = "9425", json = "[]"] = process.argv.slice(2);
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
for (const ev of JSON.parse(json)) {
  const { waitMs = 0, ...params } = ev;
  await cdp.send("Input.dispatchMouseEvent", { button: "none", clickCount: 1, ...params });
  if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
}
cdp.close();
