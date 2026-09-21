#!/usr/bin/env node
// Pilote les crochets de développement de l'app (`__tentaclePlayer`,
// `__tentacleOffline`, globaux `__DEV__`) par l'inspecteur Hermes de Metro :
// `GET /json/list` donne la cible, une session CDP fait `Runtime.evaluate`.
// Remplace la procédure manuelle de docs/MOBILE-LECTEUR-MPV.md §7.
//
// Usage :
//   node scripts/dev-hook.mjs '__tentaclePlayer.engine'
//   node scripts/dev-hook.mjs '__tentacleOffline.keep("<itemId>")'   # une promesse est attendue
//   node scripts/dev-hook.mjs --list                # les cibles de l'inspecteur
// Options : --host <hôte:port> (défaut localhost:8081), --timeout <ms> (défaut 20000),
//           --device <texte> (plusieurs appareils branchés : celui dont le nom contient ce texte).
// Node 22 : `fetch` et `WebSocket` sont globaux, aucune dépendance.

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  args.splice(index, 2);
  return value;
};
const host = option("--host", "localhost:8081");
const timeoutMs = Number(option("--timeout", "20000"));
const deviceFilter = option("--device", "");
const listOnly = args.includes("--list");
const expression = args.filter((a) => a !== "--list").join(" ");

/** Les cibles Hermes annoncées par Metro ; l'app doit être ouverte et connectée. */
async function targets() {
  const response = await fetch(`http://${host}/json/list`);
  if (!response.ok) throw new Error(`Metro ${host} : HTTP ${response.status}`);
  const pages = await response.json();
  return pages.filter((p) => typeof p.webSocketDebuggerUrl === "string");
}

const PENDING = "__devHookPending__";
const READ_RESULT = `(globalThis.__devHookSettled ? globalThis.__devHookResult : ${JSON.stringify(PENDING)})`;
/** L'expression, sans `await` (Hermes refuse de le compiler ici) : une promesse rendue se dépose dans un global. */
const wrap = (source) => `(function () {
  const value = (${source});
  if (!value || typeof value.then !== "function") return value;
  globalThis.__devHookSettled = false;
  value.then(function (v) { globalThis.__devHookResult = v; globalThis.__devHookSettled = true; },
             function (e) { globalThis.__devHookResult = { error: String(e) }; globalThis.__devHookSettled = true; });
  return ${JSON.stringify(PENDING)};
})()`;

/** Une expression évaluée dans le JS de l'app, valeur rendue par copie ; une promesse est attendue. */
function evaluate(target, source) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const timer = setTimeout(() => { socket.close(); reject(new Error(`délai dépassé (${timeoutMs} ms)`)); }, timeoutMs);
    socket.onerror = (event) => { clearTimeout(timer); reject(new Error(`WebSocket : ${event.message ?? "erreur"}`)); };
    socket.onopen = () => {
      socket.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: wrap(source), returnByValue: true } }));
    };
    let nextId = 2;
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id === undefined) return;
      if (message.error) { clearTimeout(timer); socket.close(); return reject(new Error(message.error.message)); }
      const { result, exceptionDetails } = message.result;
      if (exceptionDetails) {
        clearTimeout(timer); socket.close();
        return reject(new Error(`exception : ${exceptionDetails.exception?.description ?? exceptionDetails.text}`));
      }
      // Une promesse : Hermes n'honore pas `awaitPromise` ici, on relit le
      // résultat déposé dans un global jusqu'à ce qu'il arrive.
      if (result.value === PENDING) {
        setTimeout(() => socket.send(JSON.stringify({ id: nextId++, method: "Runtime.evaluate", params: { expression: READ_RESULT, returnByValue: true } })), 200);
        return;
      }
      clearTimeout(timer);
      socket.close();
      resolve(result.value === undefined ? result.description ?? result.type : result.value);
    };
  });
}

const pages = await targets();
if (listOnly || !expression) {
  for (const page of pages) console.log(`${page.id}\t${page.title}\t${page.deviceName ?? ""}\t${page.description ?? ""}`);
  if (!expression) process.exit(pages.length > 0 ? 0 : 1);
}
// Une seule app branchée : la cible de l'app (« React Native Bridgeless »),
// pas le runtime UI de Reanimated.
const candidates = pages.filter((p) => !deviceFilter || `${p.deviceName ?? ""} ${p.description ?? ""}`.includes(deviceFilter));
const target = candidates.find((p) => /react native/i.test(p.title) && !/reanimated/i.test(p.title)) ?? candidates[0];
if (!target) { console.error("aucune cible : l'app n'est pas ouverte, ou Metro n'écoute pas sur " + host); process.exit(1); }
try {
  const value = await evaluate(target, expression);
  console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
