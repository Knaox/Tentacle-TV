// La contre-épreuve du démon CDP (`lib/cdpDaemon.mjs`) contre un FAUX inspecteur
// de Metro : deux apps candidates → il refuse de relever (409, message clair) ;
// une seule (l'app du simulateur à côté, écartée) → il s'y connecte et répond.
// `node --test apps/tv/harness/nav-golden/test/`.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws"); // le `ws` de la racine : l'ancienne API (Server)
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Le faux Metro : `/json/list` modifiable, et des pages qui répondent 42 à toute évaluation. */
function fakeMetro() {
  const pages = [];
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(req.url === "/json/list" ? pages : {}));
  });
  const wss = new WebSocketServer({ server, path: "/inspector/debug" });
  wss.on("connection", (socket) => socket.on("message", (raw) => {
    const msg = JSON.parse(String(raw));
    socket.send(JSON.stringify({ id: msg.id, result: msg.method === "Runtime.evaluate" ? { result: { type: "number", value: 42 } } : {} }));
  }));
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, wss, pages, port: server.address().port })));
}

const page = (port, appId, deviceName, device) => ({
  id: `${device}-1`, appId, deviceName, description: "React Native Bridge",
  webSocketDebuggerUrl: `ws://127.0.0.1:${port}/inspector/debug?device=${device}&page=1`, reactNative: { logicalDeviceId: device },
});

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function until(check, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await check();
    if (value) return value;
    await sleep(150);
  }
  return null;
}

const metro = await fakeMetro();
const cdpPort = await freePort();
const daemon = spawn(process.execPath, [path.join(HERE, "../lib/cdpDaemon.mjs")], {
  env: { ...process.env, CDPD_PORT: String(cdpPort), METRO_PORT: String(metro.port), CDP_APP_ID: "com.tentacle.mobile.navtest", AGENT_CONSOLE: "" },
  stdio: "ignore",
});
after(async () => {
  daemon.kill("SIGTERM"); // notre propre processus enfant, rien d'autre
  metro.wss.close();
  await new Promise((resolve) => metro.server.close(resolve));
});

const target = async () => (await fetch(`http://127.0.0.1:${cdpPort}/target`).catch(() => null))?.json?.() ?? null;
const evalJs = (expression) => fetch(`http://127.0.0.1:${cdpPort}/eval`, { method: "POST", body: expression });

test("deux appareils portent l'app de test : refus explicite, aucun relevé", async () => {
  metro.pages.splice(0, metro.pages.length, page(metro.port, "com.tentacle.mobile.navtest", "Chambre", "atv1"), page(metro.port, "com.tentacle.mobile.navtest", "Salon", "atv2"));
  const state = await until(async () => ((await target())?.state === "ambiguous" ? await target() : null));
  assert.ok(state, "le démon n'a pas vu l'ambiguïté");
  assert.equal(state.connected, false);
  const res = await evalJs("6 * 7");
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.match(body.message, /plusieurs cibles Hermes/);
  assert.match(body.message, /Chambre/);
  assert.match(body.message, /Salon/);
});

test("l'app du simulateur à côté de l'app de test : seule l'app de test est suivie", async () => {
  metro.pages.splice(0, metro.pages.length, page(metro.port, "com.tentacle.mobile", "nav-T5", "sim"), page(metro.port, "com.tentacle.mobile.navtest", "Chambre", "atv1"));
  const state = await until(async () => {
    const t = await target();
    return t?.state === "ready" && t.connected ? t : null;
  });
  assert.ok(state, "le démon ne s'est pas connecté à l'app de test");
  assert.equal(state.target.deviceName, "Chambre");
  const res = await evalJs("6 * 7");
  assert.equal(res.status, 200);
  assert.equal(await res.json(), 42);
});

test("une seconde candidate qui paraît en cours de route : le démon lâche sa cible et refuse", async () => {
  metro.pages.push(page(metro.port, "com.tentacle.mobile.navtest", "Salon", "atv2"));
  const state = await until(async () => ((await target())?.state === "ambiguous" ? await target() : null));
  assert.ok(state, "le démon a gardé sa cible malgré une seconde candidate");
  assert.equal((await evalJs("1")).status, 409);
});
