// La bascule musique → vidéo → musique SOUS CEF, par le front de Tentacle, avec les
// couches comptées dans l'arbre Core Animation (`shell.debug.layers`, socle) et la
// surface vue par le pont (`pont.debug.surface`). Suite d'`octave-scenario.mjs`.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { go } from "./octave-scenario.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FILM = process.env.OCTAVE_FILM ?? "Banc HDR10 Pistes";

export async function bascule({ cdp, env, cache, origin, appLog }) {
  let failures = 0;
  const check = (ok, what) => { if (!ok) failures++; console.log(`${ok ? "✅" : "❌"} ${what}`); return ok; };
  const waitFor = async (fn, ms = 10000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { await env.sync(); const v = await fn(); if (v) return v; await sleep(200); }
    return null;
  };
  const lastState = () => [...env.events].reverse().find((e) => e.type === "state")?.state ?? null;
  const click = (label, inDock = false) => cdp.eval(`(() => {
    const root = ${inDock} ? document.querySelector("[data-octave-dock]") : document;
    const el = [...(root?.querySelectorAll("button") ?? [])].find((b) =>
      (b.getAttribute("aria-label") ?? b.innerText.trim()) === ${JSON.stringify(label)});
    if (!el) return false; el.click(); return true; })()`);
  const clickText = (text) => cdp.eval(`(() => { const e = [...document.querySelectorAll("button")]
    .find((b) => b.innerText?.trim().startsWith(${JSON.stringify(text)})); if (!e) return false; e.click(); return true; })()`);
  // Les couches : chaque couche vidéo (TentacleVideoLayer) de l'arbre, et ce que le pont dit de sa surface.
  const layers = async (label) => {
    const r = await cdp.eval(`(async () => {
      const t = await window.__shell.invoke("shell.debug.layers", {}).catch((e) => "ERR " + e.message);
      const text = typeof t === "string" ? t : JSON.stringify(t);
      const surface = await window.__shell.invoke("pont.debug.surface", {}).catch(() => null);
      const lines = text.split("\\n");
      // La page web est AUSSI une CAMetalLayer (z=10, socle) : la vidéo, c'est TentacleVideoLayer (vidéo-HDR).
      return { metal: lines.filter((l) => /TentacleVideoLayer/.test(l)).map((l) => l.trim().slice(0, 160)),
               web: lines.filter((l) => /CAMetalLayer z=10/.test(l)).length, surface };
    })()`);
    console.log(`   ℹ︎ couches [${label}] : ${r.metal.length} couche(s) vidéo ${JSON.stringify(r.metal)}, ${r.web} couche web`);
    console.log(`   ℹ︎ surface [${label}] : ${JSON.stringify(r.surface)}`);
    return r;
  };
  const mpv = (name, format = "double") =>
    cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: ${JSON.stringify(name)}, format: ${JSON.stringify(format)} }).catch(() => null)`);
  const dismissModals = async () => { for (let i = 0; i < 4; i++) { if (!(await clickText("Fermer")) && !(await clickText("Pas maintenant"))) return; await sleep(700); } };

  console.log("\n== 9. Bascule musique → vidéo → musique (couches comptées)");
  // Musique en lecture (la session reprise en pause → « Lecture » du mini-lecteur).
  await click("Lecture", true);
  check(await waitFor(() => lastState()?.status === "playing"), "musique en lecture");
  const music = await layers("musique");
  check(music.metal.length === 0, `musique : AUCUNE couche vidéo (${music.metal.length})`);
  check((await env.prop("vid")) === false && (await env.prop("current-vo")) === null, "mpv musique : vid=no, aucune sortie vidéo");
  const ao = await env.prop("current-ao"), mute = await env.prop("mute");
  check(ao === "null" && mute === true, `mpv musique : current-ao=${ao}, mute=${mute} (aucun son)`);

  // Le parcours de Tentacle : quitter Octave (la musique s'arrête), ouvrir le film, « Lecture ».
  const stopMark = env.calls.length;
  await cdp.eval(`document.querySelector("[data-octave-back-to-films]")?.click(); true`);
  check(await waitFor(() => env.calls.slice(stopMark).some((c) => c.channel === "audio_engine_stop")), "quitter Octave : audio_engine_stop");
  const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
  const AUTH = 'MediaBrowser Client="octave-banc", Device="octave", DeviceId="octave-banc-1", Version="0.1"';
  const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, { method: "POST",
    headers: { "content-type": "application/json", authorization: AUTH },
    body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }) })).json();
  const q = new URLSearchParams({ Recursive: "true", IncludeItemTypes: "Movie", SearchTerm: FILM });
  const film = (await (await fetch(`${accounts.jellyfin}/Items?${q}`, { headers: { authorization: `${AUTH}, Token="${login.AccessToken}"` } })).json()).Items?.[0];
  if (!check(!!film, `film du banc « ${FILM} »`)) return failures;
  await go(cdp, `/media/${film.Id}`);
  await sleep(2500);
  await dismissModals();
  check(await clickText("Lecture"), "fiche du film : clic « Lecture »");
  check(await waitFor(async () => (await cdp.eval("location.pathname")).startsWith("/watch/"), 10000), "lecteur vidéo ouvert");
  const t0 = await waitFor(async () => { const a = await mpv("time-pos"); await sleep(700); const b = await mpv("time-pos"); return b > a ? b : null; }, 20000);
  check(t0, `vidéo en lecture (time-pos ${t0?.toFixed?.(2)})`);
  const video = await layers("vidéo");
  check(video.metal.length === 1, `vidéo : UNE couche vidéo (${video.metal.length})`);
  check((await mpv("video-target-params/gamma", "string")) === "pq" || FILM.indexOf("HDR") < 0,
    `sortie vidéo : gamma ${await mpv("video-target-params/gamma", "string")} (HDR passthrough)`);
  const log = readFileSync(appLog, "utf8");
  check(/\[music\] lecture vid[ée]o : musique d[ée]j[àa] au repos/.test(log), "à mpv_init : l'arbitre dit « musique déjà au repos » (Tentacle l'avait arrêtée)");

  // Retour du lecteur, puis Octave.
  await cdp.eval(`history.back(); true`);
  check(await waitFor(async () => !(await cdp.eval("location.pathname")).startsWith("/watch/"), 10000), "lecteur vidéo quitté");
  await sleep(2000);
  const after = await layers("après la vidéo");
  check(after.metal.length === 0, `après la vidéo : plus de couche vidéo (${after.metal.length})`);
  const startMark = env.calls.length;
  await go(cdp, "/octave");
  check(await waitFor(() => env.calls.slice(startMark).some((c) => c.channel === "audio_engine_start"), 15000), "retour dans Octave : audio_engine_start");
  await waitFor(() => cdp.eval(`!!document.querySelector("[data-octave-dock]")`), 8000);
  await sleep(800);
  await click("Lecture", true);
  check(await waitFor(() => lastState()?.status === "playing"), "musique relancée depuis le mini-lecteur");
  const back = await layers("retour musique");
  check(back.metal.length === 0, `retour à la musique : AUCUNE couche vidéo (${back.metal.length})`);
  return failures;
}
