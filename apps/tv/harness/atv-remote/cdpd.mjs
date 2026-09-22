// Démon CDP : une connexion persistante au runtime Hermes de l'app.
// - enregistre console.* dans console.log (fichier) avec horodatage ;
// - HTTP 127.0.0.1:8767 : POST /eval (corps = expression) → résultat.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const LOG = process.env.AGENT_CONSOLE ?? path.join(DIR, "console.log");
let ws = null;
let nextId = 1;
const pending = new Map();

function log(line) {
  fs.appendFileSync(LOG, line + "\n");
}

async function connect() {
  try {
    const list = await (await fetch("http://localhost:8081/json/list")).json();
    const target = list.find((t) => t.description?.includes("React Native Bridge")) ?? list[0];
    if (!target) throw new Error("aucune cible");
    ws = new WebSocket(target.webSocketDebuggerUrl);
    ws.onopen = () => {
      log(`--- connecté ${new Date().toISOString()}`);
      send("Runtime.enable");
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
        return;
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        const args = msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ");
        const t = new Date().toISOString().slice(11, 23);
        log(`${t} [${msg.params.type}] ${args}`);
      }
    };
    ws.onclose = () => { log("--- déconnecté"); ws = null; setTimeout(connect, 2000); };
    ws.onerror = () => {};
  } catch (e) {
    setTimeout(connect, 2000);
  }
}

function send(method, params = {}) {
  return new Promise((resolve) => {
    if (!ws || ws.readyState !== 1) return resolve({ error: "non connecté" });
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); resolve({ error: "timeout" }); } }, 15000);
  });
}

http.createServer((req, res) => {
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", async () => {
    if (req.url === "/eval") {
      const msg = await send("Runtime.evaluate", { expression: body, returnByValue: true });
      const r = msg.result?.result;
      if (msg.error) res.end("ERR " + JSON.stringify(msg.error));
      else if (msg.result?.exceptionDetails) res.end("EXC " + JSON.stringify(msg.result.exceptionDetails).slice(0, 3000));
      else if (r?.type === "string") res.end(r.value);
      else res.end(JSON.stringify(r?.value ?? r, null, 1));
      return;
    }
    res.statusCode = 404;
    res.end();
  });
}).listen(8767, "127.0.0.1", () => log("--- démon prêt"));

connect();
