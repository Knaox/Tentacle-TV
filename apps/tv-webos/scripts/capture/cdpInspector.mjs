/**
 * L'accès au débogueur du téléviseur.
 *
 * Deux pièges, tous deux payés une fois :
 *
 * 1. **Le port change à chaque lancement.** `ares-inspect` l'annonce sur sa
 *    sortie standard et nulle part ailleurs — il faut donc le lancer sans
 *    attendre sa fin et lire ce qu'il écrit.
 * 2. **Il doit rester vivant.** webOS ferme le débogueur quand `ares-inspect`
 *    sort ; un `execFileSync` — ce que fait `aresCli.mjs`, à raison pour ses
 *    usages — rendrait la main sur une session déjà close.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET_ROOT = resolve(HERE, "../..");
const REPO_ROOT = resolve(TARGET_ROOT, "../..");
const PORT_DELAY_MS = 30_000;

function entryPoint(name) {
  return [TARGET_ROOT, REPO_ROOT]
    .map((root) => resolve(root, `node_modules/@webos-tools/cli/bin/${name}.js`))
    .find(existsSync);
}

/**
 * Ouvre le débogueur et rend son adresse HTTP. `stopIt()` referme la session —
 * à appeler, sinon le téléviseur garde un inspecteur ouvert.
 */
export async function openInspector({ device, application }) {
  const entry = entryPoint("ares-inspect");
  if (!entry) throw new Error("ares-inspect introuvable : installer @webos-tools/cli");

  const child = spawn(process.execPath, [entry, "--device", device, "--app", application], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  const url = await new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => {
      reject(new Error(`aucune adresse d'inspection en ${PORT_DELAY_MS / 1000} s — mode developpeur expire ?\n${buffer}`));
    }, PORT_DELAY_MS);

    const read = (chunk) => {
      buffer += chunk.toString();
      const found = buffer.match(/https?:\/\/[\w.\-]+:\d+/);
      if (!found) return;
      clearTimeout(timer);
      resolve(found[0]);
    };
    child.stdout.on("data", read);
    child.stderr.on("data", read);
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`ares-inspect a quitte (code ${code})\n${buffer}`));
    });
  });

  return { url, stopIt: () => child.kill() };
}

/**
 * La cible à instrumenter : celle qui sert le client, et non une éventuelle
 * page de service. Le client TV est chargé depuis le backend, son URL porte
 * donc `/tv/`.
 */
export async function findTarget(inspectorUrl) {
  const response = await fetch(`${inspectorUrl}/json/list`);
  const targets = await response.json();
  const page = targets.find((c) => c.type === "page" && /\/tv\/?/.test(c.url ?? "")) ?? targets[0];
  if (!page?.webSocketDebuggerUrl) throw new Error(`aucune cible debogable : ${JSON.stringify(targets)}`);
  return page;
}

/** Une session DevTools : on envoie des commandes, on écoute des événements. */
export async function connectSession(urlWebSocket) {
  const grab = new WebSocket(urlWebSocket);
  const pending = new Map();
  const subscribers = new Map();
  let counter = 0;

  await new Promise((resolve, reject) => {
    grab.addEventListener("open", resolve, { once: true });
    grab.addEventListener("error", () => reject(new Error(`connexion refusee : ${urlWebSocket}`)), { once: true });
  });

  grab.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const promise = pending.get(message.id);
      if (!promise) return;
      pending.delete(message.id);
      if (message.error) promise.reject(new Error(`${message.error.message} (${JSON.stringify(message.error.data ?? "")})`));
      else promise.resolve(message.result);
      return;
    }
    for (const callback of subscribers.get(message.method) ?? []) callback(message.params);
  });

  return {
    send(method, params = {}) {
      const id = (counter += 1);
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        grab.send(JSON.stringify({ id, method: method, params: params }));
      });
    },
    on(event, callback) {
      const list = subscribers.get(event) ?? [];
      list.push(callback);
      subscribers.set(event, list);
    },
    close() {
      grab.close();
    },
  };
}
