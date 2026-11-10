// Recette d'Octave sur une app DÉJÀ lancée (`pnpm dev:cef -- --mute --background
// --devtools-port=<port>`, front embarqué `tentacle://app`, compte du banc connecté) :
// « À l'écoute » de la musique (fiche, pochette, commandes du système), puis le scénario
// musique du front (`octave-scenario.mjs`) et la bascule musique ↔ vidéo (`octave-bascule.mjs`).
// N'ouvre ni ne ferme rien : la session qui a lancé l'app la referme (Cmd+Q).
//
//   PONT_CDP_PORT=9424 OCTAVE_APP_LOG=<journal de l'app> node web/shim/octave-attach.mjs
import { readFileSync } from "node:fs";
import { join } from "node:path";

process.env.PONT_CDP_PORT ??= "9424";
const { Cdp, pageTarget } = await import("./dev/cdp.mjs");
const { scenario, go } = await import("./octave-scenario.mjs");
const { bascule } = await import("./octave-bascule.mjs");

const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const origin = process.env.OCTAVE_ORIGIN ?? "http://127.0.0.1:3471";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cdp = await Cdp.connect((await pageTarget()).webSocketDebuggerUrl);
await cdp.send("Runtime.enable");
const env = {
  calls: [], events: [], fromCall: 0, fromEvent: 0,
  async sync() {
    const log = await cdp.eval(`window.__shell.invoke("octave.debug.log", { fromCall: ${this.fromCall}, fromEvent: ${this.fromEvent} })`)
      .catch(() => null);
    if (!log) return;
    this.calls.push(...log.calls);
    this.events.push(...log.events);
    this.fromCall = log.callCount;
    this.fromEvent = log.eventCount;
  },
  prop: (name) => cdp.eval(`window.__shell.invoke("octave.debug.prop", { name: ${JSON.stringify(name)} })`),
  claim: () => cdp.eval(`window.__shell.invoke("octave.debug.claim", {})`),
};
const session = () => cdp.eval(`window.__shell.invoke("media_session.debug.state", {})`);
const command = (name, positionMs = 0) =>
  cdp.eval(`window.__shell.invoke("media_session.debug.command", ${JSON.stringify({ command: name, positionMs })})`);

let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log(`${ok ? "✅" : "❌"} ${what}`); return ok; };
const waitFor = async (fn, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) { await env.sync(); const v = await fn(); if (v) return v; await sleep(200); }
  return null;
};
const lastState = () => [...env.events].reverse().find((e) => e.type === "state")?.state ?? null;
const clickLabel = (label) => cdp.eval(`(() => {
  const b = [...document.querySelectorAll("button,[role=button]")].find((e) => (e.getAttribute("aria-label") ?? e.innerText.trim()) === ${JSON.stringify(label)});
  if (!b) return false; b.click(); return true; })()`);

// La « Nouveautés » (et toute feuille) s'ouvre à son heure sur un profil neuf : on la ferme.
const dismissSheets = async () => {
  for (let i = 0; i < 4; i++) {
    const closed = await cdp.eval(`(() => { const b = document.querySelector(".lg-sheet button[aria-label='Fermer']");
      if (!b) return false; b.click(); return true; })()`);
    if (!closed) return;
    await sleep(600);
  }
};

async function videoSession() {
  console.log("\n== « À l'écoute » de la VIDÉO (useSmtc, capacité smtc_set_controls)");
  const FILM = process.env.OCTAVE_FILM ?? "Banc HDR10 Pistes";
  const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
  const AUTH = 'MediaBrowser Client="medias-banc", Device="medias", DeviceId="medias-banc-1", Version="0.1"';
  const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, { method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }) })).json();
  const q = new URLSearchParams({ Recursive: "true", IncludeItemTypes: "Movie", SearchTerm: FILM });
  const film = (await (await fetch(`${accounts.jellyfin}/Items?${q}`, { headers: { authorization: `${AUTH}, Token="${login.AccessToken}"` } })).json()).Items?.[0];
  if (!check(!!film, `film du banc « ${FILM} »`)) return;
  await go(cdp, `/media/${film.Id}`);
  await sleep(2500);
  await dismissSheets();
  check(await cdp.eval(`(() => { const e = [...document.querySelectorAll("button")].find((b) => b.innerText?.trim().startsWith("Lecture"));
    if (!e) return false; e.click(); return true; })()`), "fiche du film : clic « Lecture »");
  check(await waitFor(async () => (await cdp.eval("location.pathname")).startsWith("/watch/"), 10000), "lecteur vidéo ouvert");
  const s = await waitFor(async () => { const v = await session(); return v?.shown === "video" && v.status === "playing" && v.durationMs ? v : null; }, 15000);
  check(s, `session montrée : ${JSON.stringify(s && { shown: s.shown, title: s.title, artist: s.artist, artwork: s.artwork, status: s.status, durationMs: s.durationMs, controls: s.controls })}`);
  check(s?.os?.mediaType === 2 && s.os.title === s.title && s.os.playbackState === 1 && s.os.commands.seek === false,
    `relu chez macOS (vidéo, sans saut système) : ${JSON.stringify(s?.os)}`);
  const pause = () => cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "pause", format: "flag" }).catch(() => null)`);
  await command("toggle");
  check(await waitFor(async () => (await pause()) === true), "touche lecture/pause → smtc-button toggle → mpv en pause");
  check(await waitFor(async () => (await session())?.os?.playbackState === 2), "macOS : playbackState = en pause");
  await command("toggle");
  check(await waitFor(async () => (await pause()) === false), "deuxième appui → lecture");
  await cdp.eval("history.back(); true");
  check(await waitFor(async () => !(await cdp.eval("location.pathname")).startsWith("/watch/"), 10000), "lecteur vidéo quitté");
  check(await waitFor(async () => (await session())?.shown !== "video"), "smtc_clear : la vidéo quitte « À l'écoute »");
}

async function nowPlaying() {
  console.log("\n== « À l'écoute » de la musique (macOS : MPNowPlayingInfoCenter, MPRemoteCommandCenter)");
  await env.sync();
  await go(cdp, "/octave");
  check(await waitFor(() => env.calls.some((c) => c.channel === "audio_engine_start"), 15000), "Octave : moteur démarré");
  await sleep(1500);
  check(await clickLabel("Lire Sans Blanc"), "clic « Lire Sans Blanc »");
  const play = await waitFor(() => [...env.calls].reverse().find((c) => c.channel === "audio_play"));
  check(play?.args.track.meta?.title, `audio_play porte la fiche du titre : ${JSON.stringify(play?.args.track.meta ?? null)}`);
  check(await waitFor(() => lastState()?.status === "playing"), "moteur : playing");
  const s = await waitFor(async () => { const v = await session(); return v?.shown === "music" && v.artwork ? v : null; }, 10000);
  check(s, `session montrée : ${JSON.stringify(s && { shown: s.shown, title: s.title, artist: s.artist, album: s.album, artworkBytes: s.artworkBytes, status: s.status, controls: s.controls })}`);
  check(s?.os?.active && s.os.title === s.title && s.os.artwork === true && s.os.playbackState === 1,
    `relu chez macOS : ${JSON.stringify(s?.os)}`);
  check(s?.os?.commands?.next && s.os.commands.previous && s.os.commands.seek && s.os.commands.toggle, "commandes du système actives (suivant, précédent, saut, lecture/pause)");

  let mark = env.calls.length;
  await command("toggle");
  check(await waitFor(() => env.calls.slice(mark).some((c) => c.channel === "audio_control" && c.args.action === "pause")),
    "touche lecture/pause → la page met en pause (remote pause → audio_control pause)");
  check(await waitFor(async () => (await session())?.os?.playbackState === 2), "macOS : playbackState = en pause");
  mark = env.calls.length;
  await command("play");
  check(await waitFor(() => env.calls.slice(mark).some((c) => c.channel === "audio_control" && c.args.action === "resume")),
    "commande lecture → reprise");
  await command("seek", 4000);
  check(await waitFor(async () => { const p = await env.prop("time-pos"); return typeof p === "number" && p >= 3.9 && p < 5.5; }),
    "barre du Centre de contrôle → saut natif à 4 s");
  mark = env.events.length;
  await command("next");
  check(await waitFor(() => env.events.slice(mark).some((e) => e.type === "advanced" || (e.type === "state" && e.state.trackKey !== play?.args.track.trackKey))),
    "touche suivant → titre suivant");
  check(await waitFor(async () => (await session())?.title === "Fil Deux"), "la fiche suit : Fil Deux");
  // Le scénario du front repart d'un moteur arrêté : on rend la main en pause.
  await command("pause");
  await sleep(500);
}

try {
  await cdp.eval(`localStorage.setItem("tentacle_language", "fr"); true`).catch(() => null);
  await dismissSheets();
  await nowPlaying();
  await dismissSheets();
  await videoSession();
  await dismissSheets();
  failures += await scenario({ cdp, env, cache, origin });
  if (process.env.OCTAVE_APP_LOG) {
    failures += await bascule({ cdp, env, cache, origin, appLog: process.env.OCTAVE_APP_LOG });
    const v = await session();
    check(v?.shown === "music" || v?.shown === null, `après la bascule : session ${v?.shown ?? "aucune"}`);
  }
} catch (e) {
  failures++;
  console.error("scénario interrompu :", e);
}
console.log(`\nTOTAL : ${failures} échec(s)`);
process.exit(failures === 0 ? 0 : 1);
