// Essai du shim SANS le socle : un Chrome sans tête (port CDP 9303), le faux natif
// (`fake-shell.js`) puis le shim injectés AVANT tout script de chaque document
// (`Page.addScriptToEvaluateOnNewDocument` — l'équivalent de `registerInjectedScript`),
// et le front de Tentacle chargé depuis le banc.
//
//   node web/shim/dev/run-chrome.mjs [url]     # tourne jusqu'à SIGTERM / Ctrl-C
//   node web/shim/dev/cdp-eval.mjs '<expr>'    # depuis un autre terminal
//
// ⚠️ L'injection vit tant que CE processus garde sa session : le laisser tourner.
// Son coupé (`--mute-audio`), profil à nous, aucun vol de focus (sans tête).
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Cdp, CDP_PORT, pageTarget } from "./cdp.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const profile = join(cache, "profiles/pont/chrome-fake");
const outDir = join(cache, "build/pont");
const consoleLog = join(outDir, "fake-console.log");
const url = process.argv[2] ?? "http://127.0.0.1:3471/";
const chromeBin = process.env.PONT_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

mkdirSync(profile, { recursive: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(consoleLog, "");

const config = {
  origins: [new URL(url).origin],
  serverUrl: new URL(url).origin,
  version: "1.42.0",
  platform: "darwin",
  titleBarHeight: 0,
  events: ["mpv://event", "mpv://property-change", "window://fullscreen"],
};
// Le natif injectera une liste figée ; ici elle vient du faux natif lui-même.
const configJs = `Object.assign(${JSON.stringify(config)}, { commands: window.__fakeCommands ?? [] })`;
const shim = readFileSync(join(here, "../tentacle-bridge.js"), "utf8").replace("__TENTACLE_SHIM_CONFIG__", configJs);
const fake = readFileSync(join(here, "fake-shell.js"), "utf8");

const chrome = spawn(chromeBin, [
  "--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
  "--mute-audio", "--no-first-run", "--no-default-browser-check", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
writeFileSync(join(outDir, "chrome-fake.pid"), String(chrome.pid));
const stop = () => { try { chrome.kill("SIGTERM"); } catch { /* déjà parti */ } process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

let target = null;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  target = await pageTarget().catch(() => null);
}
if (!target) { console.error("Chrome n'a pas ouvert son port CDP"); stop(); }

const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `${fake}\n${shim}` });
cdp.on("Runtime.consoleAPICalled", (p) => {
  const text = p.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
  appendFileSync(consoleLog, `${new Date().toISOString()} [${p.type}] ${text}\n`);
});
cdp.on("Runtime.exceptionThrown", (p) => {
  appendFileSync(consoleLog, `${new Date().toISOString()} [exception] ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}\n`);
});
await cdp.send("Page.navigate", { url });
console.log(`Chrome du pont prêt (CDP ${CDP_PORT}, pid ${chrome.pid}) sur ${url} — console : ${consoleLog}`);
chrome.on("exit", () => process.exit(0));
