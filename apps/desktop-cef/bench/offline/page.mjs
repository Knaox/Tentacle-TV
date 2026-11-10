// Outils du banc hors ligne : évaluer dans la page de Tentacle CEF (DevTools distants) et y
// appeler `window.tentacle` comme le front le ferait. Sans dépendance (Node ≥ 22).
import { Cdp, pageTarget } from "../../web/shim/dev/cdp.mjs";

export const PORT = Number(process.env.HORSLIGNE_CDP_PORT ?? 9422);

export async function connect() {
  return Cdp.connect((await pageTarget(PORT)).webSocketDebuggerUrl);
}

/** Évalue `body` (corps d'une fonction async, `t` = window.tentacle) et rend sa valeur. */
export async function run(cdp, body, args = {}) {
  const expression = `(async (args) => { const t = window.tentacle; ${body} })(${JSON.stringify(args)})`;
  return cdp.eval(expression);
}

/** `invoke` qui rend `{ok}` ou `{error}` — jamais ne lève. */
export async function invoke(cdp, command, payload = {}) {
  return run(
    cdp,
    `try { return { ok: await t.invoke(args.c, args.p) }; } catch (e) { return { error: String(e && e.message || e) }; }`,
    { c: command, p: payload },
  );
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Attend que `check()` rende une valeur vraie (au plus `ms`), et la rend. */
export async function until(check, ms = 60000, label = "condition") {
  const end = Date.now() + ms;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error(`délai dépassé : ${label}`);
    await sleep(250);
  }
}

/** La session du front (serveur, jeton, compte), lue dans son stockage. */
export async function session(cdp) {
  return run(
    cdp,
    `const u = JSON.parse(localStorage.getItem("tentacle_user"));
     return { server: localStorage.getItem("tentacle_server_url"), token: localStorage.getItem("tentacle_token"), userId: u.Id };`,
  );
}

/** Un GET JSON du proxy Jellyfin (le jeton en `X-Emby-Token`, comme le front). */
export async function jellyfin(cdp, path) {
  return run(
    cdp,
    `const s = localStorage.getItem("tentacle_server_url"), tok = localStorage.getItem("tentacle_token");
     const r = await fetch(s + "/api/jellyfin" + args.path, { headers: { "X-Emby-Token": tok } });
     return r.ok ? await r.json() : { status: r.status };`,
    { path },
  );
}

/** Les évènements `downloads://*` reçus par la page depuis l'installation. */
export async function listenEvents(cdp) {
  return run(
    cdp,
    `if (!window.__horsligne) {
       window.__horsligne = { progress: [], changed: 0 };
       t.on("downloads://progress", (p) => window.__horsligne.progress.push(p));
       t.on("downloads://changed", () => window.__horsligne.changed++);
     }
     return true;`,
  );
}

export async function events(cdp) {
  return run(cdp, `return window.__horsligne;`);
}

/** Commande du relais (/cut, /restore, /state). */
export async function relay(command, port = 34712) {
  return (await fetch(`http://127.0.0.1:${port}/${command}`)).text();
}
