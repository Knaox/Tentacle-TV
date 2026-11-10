#!/usr/bin/env node
// Commandes de window.tentacle : celles d'Electron (main/channels.ts, COMMANDS) face à celles
// que Tentacle CEF déclare (window.tentacle.capabilities). node tests/recette/capacites.mjs <port>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";
const port = Number(process.argv[2] ?? 9425);
const src = readFileSync(fileURLToPath(new URL("../../../desktop-electron/src/main/channels.ts", import.meta.url)), "utf8");
const block = src.slice(src.indexOf("export const COMMANDS"), src.indexOf("] as const", src.indexOf("export const COMMANDS")));
const electron = [...block.matchAll(/"([a-z0-9_:\-]+)"/g)].map((m) => m[1]);
const cdp = await Cdp.connect((await pageTarget(port)).webSocketDebuggerUrl);
const cef = await cdp.eval("window.tentacle.capabilities");
cdp.close();
const missing = electron.filter((c) => !cef.includes(c));
const extra = cef.filter((c) => !electron.includes(c));
console.log(`Electron : ${electron.length} commandes ; CEF : ${cef.length} ; manquantes : ${missing.length}`);
console.log(`manquantes : ${missing.join(", ")}`);
if (extra.length) console.log(`en plus sous CEF : ${extra.join(", ")}`);
