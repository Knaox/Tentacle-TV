// Met l'app (proto CEF ou bureau Electron) dans l'état d'un scénario de mesure, par CDP,
// avec le VRAI front de Tentacle et ses contrôles. Rend la main dès que l'état est atteint ;
// la mesure (fenetre.py) se fait à côté. Son : le lecteur doit être muet, sinon abandon.
//
//   node bench/mesures/scenario.mjs <port> accueil
//   node bench/mesures/scenario.mjs <port> video "<titre>" [fs]
//   node bench/mesures/scenario.mjs <port> sortie [fs]
//   node bench/mesures/scenario.mjs <port> musique
//   node bench/mesures/scenario.mjs <port> etat
const [port, cmd, ...rest] = process.argv.slice(2);
process.env.PONT_CDP_PORT = port;
const { Cdp, pageTarget } = await import("../../web/shim/dev/cdp.mjs");
const { findItem } = await import("../../web/shim/dev/drive.mjs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cdp = await Cdp.connect((await pageTarget(Number(port))).webSocketDebuggerUrl);
const ev = (js) => cdp.eval(js);
const waitFor = async (fn, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn().catch(() => null); if (v) return v; await sleep(200); }
  return null;
};
// Navigation interne (React Router) : marche sous http:// (proto) comme sous tentacle:// (Electron).
const go = (path) => ev(`history.pushState({}, "", ${JSON.stringify(path)}); dispatchEvent(new PopStateEvent("popstate")); true`);
const clickText = (text) => ev(`(() => { const el = [...document.querySelectorAll("button,a")]
  .find((e) => e.innerText?.trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const clickLabel = (label) => ev(`(() => { const el = [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === ${JSON.stringify(label)}); if (!el) return false; el.click(); return true; })()`);
// Modales d'accueil (« Nouveautés » : bouton « Fermer » en aria-label ; « Choisissez votre
// personnage » : « Pas maintenant ») : elles arrivent en retard, et leurs animations infinies
// faisaient mesurer une page animée au lieu de l'accueil au repos.
const dismiss = async () => { for (let i = 0; i < 4; i++) { if (!(await clickText("Pas maintenant")) && !(await clickText("Fermer")) && !(await clickLabel("Fermer"))) return; await sleep(600); } };
const key = async (code, k, vk) => { for (const type of ["keyDown", "keyUp"]) await cdp.send("Input.dispatchKeyEvent", { type, code, key: k, windowsVirtualKeyCode: vk }); };
const wake = () => cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 640 + Math.random() * 20, y: 500 });
// État de mpv : d'abord ce que le pont a émis (Electron ne rend par `mpv_get_property` que les
// propriétés déjà observées), sinon une lecture par la porte de la page.
const probe = () => ev(`(() => { if (window.__mesure) return true; const p = (window.__mesure = {});
  window.tentacle.on("mpv://property-change", (c) => { p[c.name] = c.data; }); return true; })()`);
const prop = async (name, format = "double") => {
  const seen = await ev(`window.__mesure?.[${JSON.stringify(name)}] ?? null`);
  if (seen !== null) return seen;
  return ev(`window.tentacle.invoke("mpv_get_property", { name: ${JSON.stringify(name)}, format: ${JSON.stringify(format)} }).catch(() => null)`);
};
const out = (o) => { console.log(JSON.stringify(o)); cdp.close(); process.exit(o.ok === false ? 1 : 0); };

if (cmd === "accueil") {
  // Le proto tué ne garde pas toujours sa session : formulaire du front si besoin.
  const where = await waitFor(() => ev(`document.querySelector('input[autocomplete="username"]') ? "login"
    : (location.pathname !== "/login" && /Accueil/.test(document.body?.innerText ?? "") ? "accueil" : null)`), 20000);
  if (where === "login") {
    const { readFileSync } = await import("node:fs");
    const account = JSON.parse(readFileSync(`${process.env.HOME}/.cache/tentacle-cef/banc/comptes.json`, "utf8")).admin;
    await ev(`(async () => {
      const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v);
        el.dispatchEvent(new Event("input", { bubbles: true })); };
      const u = document.querySelector('input[autocomplete="username"]'), p = document.querySelector('input[autocomplete="current-password"]');
      set(u, ${JSON.stringify(account.name)}); set(p, ${JSON.stringify(account.password)});
      (p.form ?? document.querySelector("form")).requestSubmit();
      for (let i = 0; i < 50 && location.pathname === "/login"; i++) await new Promise((r) => setTimeout(r, 200)); })()`);
    await sleep(2500);
  }
  // Langue (libellés cherchés en français) et sourdine persistée du lecteur : le proto tué perd
  // son localStorage. Rechargement pour que le front les relise.
  const keys = { tentacle_language: "fr", tentacle_player_muted: "1", tentacle_player_volume: "0", tentacle_octave_volume: "0", tentacle_whats_new_seen: "1.42.0" };
  const missing = await ev(`(() => { const k = ${JSON.stringify(keys)}; let m = false;
    for (const [n, v] of Object.entries(k)) if (localStorage.getItem(n) !== v) { localStorage.setItem(n, v); m = true; } return m; })()`);
  if (missing) {
    await ev("location.reload(); true").catch(() => null);
    await sleep(3000);
    await waitFor(() => ev(`/Accueil/.test(document.body?.innerText ?? "")`), 20000);
  }
  // Le front rouvre le mode musique s'il était actif à l'arrêt (`tentacle_octave_mode`, passe
  // précédente finie dans Octave) : on en sort par son bouton « Films et séries », comme un
  // utilisateur (un simple retour à « / » est renvoyé vers /octave). Puis « / » jusqu'à ce
  // que la page y reste, sans modale, 4 s de suite.
  // Souris de la page dans un coin vide (un survol resté sur une tuile l'anime sans fin),
  // AVANT l'attente : un pointermove relance la bannière pendant 20 s (useIdle du front).
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 796 });
  let stable = 0;
  for (let i = 0; i < 30 && stable < 4; i++) {
    await dismiss();
    const [path, dialogs] = await ev(`[location.pathname, document.querySelectorAll('[role=dialog]').length]`);
    if (path.startsWith("/octave")) { await clickText("Films et séries"); stable = 0; }
    else if (path !== "/") { await go("/"); stable = 0; } else stable = dialogs ? 0 : stable + 1;
    await sleep(1000);
  }
  const page = await ev("location.pathname");
  const anims = await ev(`document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity).length`);
  out({ ok: page === "/" && stable >= 4, connexion: where, page, stable, animationsInfinies: anims });
}

if (cmd === "etat") {
  // Cadence (axe lecteur) : images sautées par la sortie / le décodeur, et décodeur réel.
  out({ page: await ev("location.pathname"), timePos: await prop("time-pos"), pause: await prop("pause", "flag"), mute: await prop("mute", "flag"), volume: await prop("volume"),
    drop: await prop("frame-drop-count", "int64"), decDrop: await prop("decoder-frame-drop-count", "int64"),
    delayed: await prop("vo-delayed-frame-count", "int64"), hwdec: await prop("hwdec-current", "string"),
    hwdecThreads: await prop("hwdec-threads", "int64"), displayFps: await prop("display-fps") });
}

if (cmd === "video") {
  const [title, fs] = rest;
  const id = (await findItem(title)).item.Id;
  await probe();
  await go(`/media/${id}`);
  // La fiche du BON titre d'abord : l'accueil a aussi un bouton « Lecture ».
  if (!(await waitFor(() => ev(`location.pathname === "/media/${id}" && document.body.innerText.includes(${JSON.stringify(title)})`), 10000)))
    out({ ok: false, err: "fiche introuvable" });
  await sleep(800);
  await dismiss();
  if (!(await clickText("Lecture"))) out({ ok: false, err: "bouton Lecture introuvable" });
  if (!(await waitFor(async () => (await ev("location.pathname")).startsWith("/watch/"), 10000))) out({ ok: false, err: "pas de /watch/" });
  // Avance réelle de time-pos (une modale tardive peut mettre en pause : on la ferme, on relance).
  let moving = false;
  for (let i = 0; i < 30 && !moving; i++) {
    const a = await prop("time-pos"); await sleep(500); const b = await prop("time-pos");
    moving = a !== null && b !== null && b > a;
    if (!moving) { await dismiss(); if ((await prop("pause", "flag")) === true) { await wake(); await key("Space", " ", 32); } }
  }
  const mute = await prop("mute", "flag"), volume = await prop("volume");
  if (!(mute === true || mute === "yes" || volume === 0 || volume === "0")) { await key("Space", " ", 32); out({ ok: false, err: `lecteur NON muet (mute=${mute}, volume=${volume}) : mis en pause` }); }
  if (fs === "fs") {
    await wake(); await key("KeyF", "f", 70);
    await sleep(2500);
  }
  out({ ok: moving, timePos: await prop("time-pos"), mute, volume, fs: fs === "fs", gamma: await prop("video-params/gamma", "string") });
}

if (cmd === "sortie") {
  if (rest[0] === "fs") { await wake(); await key("KeyF", "f", 70); await sleep(2000); }
  if ((await ev("location.pathname")).startsWith("/watch/")) { await wake(); await key("Escape", "Escape", 27); }
  await waitFor(async () => !(await ev("location.pathname")).startsWith("/watch/"), 8000);
  await go("/"); await sleep(1000);
  out({ ok: true, page: await ev("location.pathname") });
}

if (cmd === "musique") {
  await go("/octave");
  const label = "Lire Grand Format";  // album d'un titre de 360 s : couvre la fenêtre de 60 s
  if (!(await waitFor(() => clickLabelExists(label), 20000))) out({ ok: false, err: "Octave : bouton « Lire Grand Format » absent" });
  // Moteur démarré à l'entrée dans Octave : sourdine et volume 0 AVANT la lecture (jamais monter).
  const muted = await ev(`Promise.all([window.tentacle.invoke("audio_control", { action: "muted", value: true }),
    window.tentacle.invoke("audio_control", { action: "volume", value: 0 })]).then(() => true, (e) => String(e))`);
  if (muted !== true) out({ ok: false, err: `sourdine refusée : ${muted}` });
  await clickLabel(label);
  const dock = await waitFor(() => ev(`(() => { const d = document.querySelector("[data-octave-dock]");
    return d && d.getBoundingClientRect().height > 0 && /Six Minutes/.test(d.innerText) ? d.innerText.replace(/\\s+/g, " ").slice(0, 60) : null; })()`), 15000);
  out({ ok: !!dock, dock, page: await ev("location.pathname") });
}

function clickLabelExists(label) {
  return ev(`[...document.querySelectorAll("button")].some((b) => b.getAttribute("aria-label") === ${JSON.stringify(label)})`);
}

out({ ok: false, err: `commande inconnue : ${cmd}` });
