#!/usr/bin/env node
// Clic CDP (Input.dispatchMouseEvent) dans la page : node tests/recette/click.mjs <port> <x> <y> [left|middle|right] [modifiers]
// modifiers : 1 Alt, 2 Ctrl, 4 Meta/⌘, 8 Maj (somme).
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";
const [port = "9425", x, y, button = "left", modifiers = "0"] = process.argv.slice(2);
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
const base = { x: Number(x), y: Number(y), button, modifiers: Number(modifiers), clickCount: 1 };
await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: base.x, y: base.y });
await cdp.send("Input.dispatchMouseEvent", { ...base, type: "mousePressed" });
await cdp.send("Input.dispatchMouseEvent", { ...base, type: "mouseReleased" });
cdp.close();
