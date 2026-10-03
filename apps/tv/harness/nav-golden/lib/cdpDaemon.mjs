// Le démon CDP d'une place : UNE connexion au runtime Hermes de l'app
// relevée — choisie sans ambiguïté (`cdpTarget.mjs`) —, gardée entre les
// commandes, reconnectée seule après un démarrage à froid. Si une autre app
// candidate paraît sur le même Metro, il se DÉCONNECTE et refuse de relever
// (409) au lieu de suivre l'une des deux.
//
//   CDPD_PORT=923n METRO_PORT=818n CDP_APP_ID=<bundle> [CDP_DEVICE_NAME=<nom>] node cdpDaemon.mjs
//
// HTTP 127.0.0.1:CDPD_PORT : POST /eval (corps = expression), POST /cdp
// ({ method, params }), GET /target (état, cible, candidates). La console JS
// de l'app est écrite dans AGENT_CONSOLE.
import fs from "node:fs";
import http from "node:http";
import { ambiguityMessage, selectTarget } from "./cdpTarget.mjs";

const PORT = Number(process.env.CDPD_PORT ?? 9232);
const METRO = Number(process.env.METRO_PORT ?? 8182);
const APP_ID = process.env.CDP_APP_ID ?? "com.tentacle.mobile";
const DEVICE_NAME = process.env.CDP_DEVICE_NAME || null;
const LOG = process.env.AGENT_CONSOLE ?? null;
const log = (line) => LOG && fs.appendFileSync(LOG, `${line}\n`);

let ws = null;
let connectedTo = null;
let selection = { state: "waiting", candidates: [], others: [] };
let nextId = 1;
const pending = new Map();

async function list() {
  try {
    return await (await fetch(`http://127.0.0.1:${METRO}/json/list`, { signal: AbortSignal.timeout(3000) })).json();
  } catch {
    return [];
  }
}

function disconnect(reason) {
  if (!ws) return;
  log(`--- déconnecté (${reason}) ${new Date().toISOString()}`);
  const socket = ws;
  ws = null;
  connectedTo = null;
  try {
    socket.close();
  } catch {
    // déjà fermée
  }
}

function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  ws = socket;
  connectedTo = target.id;
  socket.onopen = () => {
    log(`--- connecté à ${target.appId} sur « ${target.deviceName} » ${new Date().toISOString()}`);
    send("Runtime.enable");
  };
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.consoleAPICalled") {
      const args = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
      log(`${new Date().toISOString().slice(11, 23)} [${msg.params.type}] ${args}`);
    }
  };
  socket.onclose = () => {
    if (ws === socket) {
      ws = null;
      connectedTo = null;
    }
  };
  socket.onerror = () => {};
}

/** Toutes les secondes : la cible est-elle toujours seule, et la même ? */
async function watch() {
  selection = selectTarget(await list(), { appId: APP_ID, deviceName: DEVICE_NAME });
  if (selection.state !== "ready") disconnect(selection.state);
  else if (connectedTo !== selection.target.id) {
    disconnect("nouvelle cible");
    connect(selection.target);
  }
  setTimeout(watch, 1000);
}

function send(method, params = {}) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== 1) return resolve({ error: "non connecté" });
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        resolve({ error: "timeout" });
      }
    }, method === "Profiler.stop" ? 120_000 : 15_000);
  });
}

const reply = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    if (req.url === "/target") return reply(res, 200, { ...selection, connected: Boolean(ws && ws.readyState === 1), appId: APP_ID, deviceName: DEVICE_NAME });
    if (selection.state === "ambiguous") {
      return reply(res, 409, { error: "ambiguous", message: ambiguityMessage(selection, { appId: APP_ID, metroPort: METRO }), candidates: selection.candidates });
    }
    if (req.url === "/cdp") {
      const { method, params } = JSON.parse(body || "{}");
      const msg = await send(method, params ?? {});
      return reply(res, 200, msg.result ?? msg);
    }
    if (req.url === "/eval") {
      const msg = await send("Runtime.evaluate", { expression: body, returnByValue: true });
      if (msg.error) return reply(res, 200, { error: msg.error });
      return reply(res, 200, msg.result?.result?.value ?? null);
    }
    return reply(res, 404, {});
  });
}).listen(PORT, "127.0.0.1", () => log(`--- démon prêt (${PORT}, Metro ${METRO}, cible ${APP_ID}${DEVICE_NAME ? ` sur « ${DEVICE_NAME} »` : ""})`));

watch();
