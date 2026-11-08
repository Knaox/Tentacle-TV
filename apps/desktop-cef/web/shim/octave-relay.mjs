// Octave AVANT le socle : le VRAI front de Tentacle (Chrome sans tête, CDP 9304)
// branché sur le VRAI moteur musique C++ (`tests/music/octave_relay`, libmpv,
// `ao=null`, muet). Un faux `__shell` dans la page envoie `tentacle:audio_*` au
// relais par une liaison CDP ; les évènements du moteur reviennent par
// `Runtime.evaluate`. Le shim est celui du pont (`tentacle-bridge.js`), tel quel.
//
//   node web/shim/octave-relay.mjs      (le banc du pont doit tourner)
// Journal de tout l'échange : ~/.cache/tentacle-cef/build/octave-player/relay.log
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.PONT_CDP_PORT ??= "9304";  // le port d'octave
const { Cdp, pageTarget } = await import("./dev/cdp.mjs");
const { scenario } = await import("./octave-scenario.mjs");

const here = dirname(fileURLToPath(import.meta.url));
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const build = join(cache, "build/octave-player");
const logFile = join(build, "relay.log");
const origin = "http://127.0.0.1:3471";
const chromeBin = process.env.PONT_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const COMMANDS = ["audio_engine_start", "audio_engine_stop", "audio_play", "audio_set_next", "audio_swap_source",
  "audio_control", "audio_list_outputs", "audio_set_output", "audio_level"];
mkdirSync(build, { recursive: true });
writeFileSync(logFile, "");
// Le jeton de test ne s'écrit jamais en clair, même dans le journal du banc.
const log = (dir, obj) => appendFileSync(logFile, `${new Date().toISOString()} ${dir} ${
  JSON.stringify(obj).replace(/("X-Emby-Token":")[^"]+/g, "$1…")}\n`);

// --- le moteur -------------------------------------------------------------------
const relay = spawn(join(build, "octave_relay"), ["null"], { stdio: ["pipe", "pipe", "inherit"] });
const pending = new Map();
let nextBench = 1_000_000;
const relayed = { calls: [], events: [] };  // ce que le front a demandé, ce que le moteur a dit
let cdp = null;
createInterface({ input: relay.stdout }).on("line", (line) => {
  const msg = JSON.parse(line);
  log("<", msg);
  if (msg.event) {
    relayed.events.push({ t: Date.now(), ...msg.payload });
    void cdp?.send("Runtime.evaluate", { expression: `window.__octaveEvent(${JSON.stringify(line)})` });
    return;
  }
  const bench = pending.get(msg.id);
  if (bench) { pending.delete(msg.id); bench(msg); return; }
  void cdp?.send("Runtime.evaluate", { expression: `window.__octaveReply(${JSON.stringify(line)})` });
});
const send = (msg) => { log(">", msg); relay.stdin.write(`${JSON.stringify(msg)}\n`); };
/** Canaux de banc du relais (`__claim`, `__prop`), hors de la page. */
const bench = (channel, args = {}) => new Promise((resolve) => {
  const id = nextBench++;
  pending.set(id, resolve);
  send({ id, channel, args });
});

// --- la page : faux __shell (forme du socle) puis le shim du pont ------------------
const fakeShell = `(() => {
  if (window.top !== window) return;
  const listeners = new Map(), waiting = new Map(); let n = 0;
  window.__octaveReply = (line) => { const m = JSON.parse(line); const p = waiting.get(m.id); if (!p) return;
    waiting.delete(m.id); if (m.ok) p.resolve(m.value); else p.reject(Object.assign(new Error(m.message), { code: m.code })); };
  window.__octaveEvent = (line) => { const m = JSON.parse(line);
    for (const cb of listeners.get("tentacle:" + m.event) ?? []) cb(m.payload); };
  window.__shell = {
    invoke(channel, payload) {
      if (!channel.startsWith("tentacle:audio_"))
        return Promise.reject(Object.assign(new Error("no_handler"), { code: "no_handler" }));
      const id = ++n;
      return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject });
        window.__octaveNative(JSON.stringify({ id, channel: channel.slice(9), args: payload ?? {} })); });
    },
    on(event, cb) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(cb);
      return () => listeners.set(event, listeners.get(event).filter((x) => x !== cb)); },
  };
})();`;
const config = { origins: [origin], serverUrl: origin, version: "1.42.0", platform: "darwin", titleBarHeight: 0,
  commands: COMMANDS, events: ["audio://event"] };
const shim = readFileSync(join(here, "tentacle-bridge.js"), "utf8").replace("__TENTACLE_SHIM_CONFIG__", JSON.stringify(config));

const profile = join(cache, "profiles/octave/chrome-relay");
mkdirSync(profile, { recursive: true });
const chrome = spawn(chromeBin, ["--headless=new", `--remote-debugging-port=${process.env.PONT_CDP_PORT}`,
  `--user-data-dir=${profile}`, "--mute-audio", "--no-first-run", "--no-default-browser-check",
  "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
const stopAll = (code) => { try { chrome.kill("SIGTERM"); } catch { /* parti */ } relay.stdin.end(); setTimeout(() => process.exit(code), 1500); };
process.on("SIGINT", () => stopAll(130));

let target = null;
for (let i = 0; i < 50 && !target; i++) {
  await new Promise((r) => setTimeout(r, 200));
  target = await pageTarget().catch(() => null);
}
if (!target) { console.error("Chrome n'a pas ouvert son port CDP"); stopAll(2); }
cdp = await Cdp.connect(target.webSocketDebuggerUrl);
await cdp.send("Page.enable");
await cdp.send("Runtime.enable");
await cdp.send("Runtime.addBinding", { name: "__octaveNative" });
cdp.on("Runtime.bindingCalled", (p) => {
  if (p.name !== "__octaveNative") return;
  const msg = JSON.parse(p.payload);
  relayed.calls.push({ t: Date.now(), channel: msg.channel, args: msg.args });
  send(msg);
});
cdp.on("Runtime.consoleAPICalled", (p) => {
  const text = p.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
  if (/music|audio|octave|bridge/i.test(text)) log("console", text.slice(0, 400));
});
await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `${fakeShell}\n${shim}` });
await cdp.send("Page.navigate", { url: `${origin}/` });

let failures = 1;
try {
  const env = {
    calls: relayed.calls, events: relayed.events, sync: async () => {},
    prop: async (name) => (await bench("__prop", { name })).value,
    claim: async () => (await bench("__claim")).value,
  };
  failures = await scenario({ cdp, env, cache, origin });
} catch (e) {
  console.error("scénario interrompu :", e);
}
stopAll(failures === 0 ? 0 : 1);
