// Ce qu'Electron fait au lecteur et que CEF doit faire pareil, PAR LE FRONT : reprise de
// position (`set start +N` au relancement), vitesse (`speed` suivi par `time-pos`), épisode
// suivant (touche N : un nouvel épisode joue, depuis le début).
// Reprise : Jellyfin ne garde AUCUNE position pour un titre plus court que
// `MinResumeDurationSeconds` (300 s par défaut) ; les médias du banc font 20 à 120 s. La
// position est donc POSÉE par l'API (données de lecture du compte, sur ce seul titre, remises à
// zéro à la fin) : on vérifie ce que font la fiche (« Reprendre »), le front et le pont.
//   PONT_CDP_PORT=9313 node bench/lecteur/lecture.mjs   (compte connecté, app lancée --mute)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const d = await connect();
const { cdp, check } = d;
const get = (name, format = "double") =>
  cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "${name}", format: "${format}" }).catch(() => null)`);
const playing = async (ms = 20000) => {
  await d.waitFor(async () => (await get("time-pos")) != null, ms);
  await sleep(1500);  // le front pause/reprend au démarrage : ne pas s'en mêler trop tôt
  if ((await get("pause", "flag")) === true) { await d.wake(); await d.key("Space"); }
  const a = await get("time-pos"); await sleep(1200); const b = await get("time-pos");
  return b > a ? b : null;
};

// Les données de lecture du compte admin (Jellyfin 12 : `/UserItems/<id>/UserData`).
const cache = process.env.TENTACLE_CEF_CACHE ?? join(process.env.HOME, ".cache/tentacle-cef");
const accounts = JSON.parse(readFileSync(join(cache, "banc/comptes.json"), "utf8"));
const AUTH = `MediaBrowser Client="tentacle-cef-banc", Device="banc", DeviceId="tentacle-cef-banc-${process.env.PONT_CDP_PORT ?? 9303}-api", Version="1.0"`;
// Un DeviceId à part : `findItem` se connecte sous celui du port, ce qui révoquerait ce jeton.
const login = await (await fetch(`${accounts.jellyfin}/Users/AuthenticateByName`, {
  method: "POST", headers: { "content-type": "application/json", authorization: AUTH },
  body: JSON.stringify({ Username: accounts.admin.name, Pw: accounts.admin.password }),
})).json();
const setPosition = (id, s) => fetch(`${accounts.jellyfin}/UserItems/${id}/UserData?userId=${login.User.Id}`, {
  method: "POST", headers: { authorization: `${AUTH}, Token="${login.AccessToken}"`, "content-type": "application/json" },
  body: JSON.stringify({ PlaybackPositionTicks: Math.round(s * 1e7) }) }).then((r) => r.status);

// --- 1. Reprise de position --------------------------------------------------------------
const { item: filmItem } = await findItem("Banc Pistes SDR");
const film = filmItem.Id;
const RESUME_AT = 40;
check("position de reprise posée chez Jellyfin", (await setPosition(film, RESUME_AT)) === 200, `${RESUME_AT} s sur « ${filmItem.Name} »`);
await cdp.eval(`localStorage.setItem("tentacle_language", "fr"); location.assign("/media/${film}")`);
await sleep(2500);
await d.dismissModals();
const resumed = await d.clickText("Reprendre");
await d.waitFor(async () => (await d.path()).startsWith("/watch/"), 8000);
await d.probe();
const back = await playing();
check("reprise de position (« Reprendre »)", resumed && back != null && Math.abs(back - RESUME_AT) < 6,
  `bouton « Reprendre » ${resumed ? "cliqué" : "ABSENT"}, posée à ${RESUME_AT} s, repartie à ${back?.toFixed(1)} s`);
await d.wake(); await d.key("Escape");
await d.waitFor(async () => !(await d.path()).startsWith("/watch/"), 8000);
await sleep(2500);
await setPosition(film, 0);

// --- 2. Vitesse ----------------------------------------------------------------------------
await d.playFromDetail(film);  // position remise à 0 : « Lecture », depuis le début
await playing();
await cdp.eval(`window.tentacle.invoke("mpv_set_property", { name: "speed", value: 1.5 })`);
const s0 = await get("time-pos"), t0 = Date.now(); await sleep(3000);
const rate = ((await get("time-pos")) - s0) / ((Date.now() - t0) / 1000);
check("vitesse 1,5×", (await get("speed")) === 1.5 && rate > 1.3 && rate < 1.7, `speed=${await get("speed")}, time-pos avance à ${rate.toFixed(2)}×`);
await cdp.eval(`window.tentacle.invoke("mpv_set_property", { name: "speed", value: 1 })`);
await d.wake(); await d.key("Escape");
await sleep(2500);

// --- 3. Épisode suivant ----------------------------------------------------------------------
const { items } = await findItem("Banc Série", "Episode");
await d.playFromDetail(items[0].Id);
await playing();
const first = await d.path();
await d.wake(); await d.key("KeyN");
const next = await d.waitFor(async () => { const p = await d.path(); return p.startsWith("/watch/") && p !== first ? p : null; }, 10000);
const pos2 = await playing();
check("épisode suivant (N)", next?.includes(items[1].Id) && pos2 != null && pos2 < 10,
  `${first} → ${next}, time-pos ${pos2?.toFixed(1)} s`);
await d.wake(); await d.key("Escape");
await sleep(2000);
d.finish();
