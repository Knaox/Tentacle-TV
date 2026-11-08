// Preuve du son SANS rien entendre (axe lecteur). L'app tourne en mode SONDE
// (`TENTACLE_SOUND_PROBE=1`) : vraie sortie native (CoreAudio) ouverte, mpv né `mute=yes`,
// échantillons mis à zéro par `af=lavfi=[volume=volume=0]`. En plus, ce banc ne
// laisse JAMAIS mpv à `mute=no` avec un volume > 0 : il remet le volume à 0 aussitôt.
//
// Vidéo : volume et sourdine RESTAURÉS par le front à l'init (localStorage), puis changés
// par ses contrôles (glissière, bouton) → `volume`/`mute` de mpv suivent, et le front
// persiste `tentacle_player_volume`/`tentacle_player_muted`. Musique (Octave) : idem par
// `audio_control`, lu sur le mpv de la musique (`octave.debug.prop`).
//
//   PONT_CDP_PORT=9313 node bench/lecteur/son.mjs   (compte connecté, app lancée en sonde)
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const d = await connect();
const { cdp, check } = d;
const get = (name, format = "node") =>
  cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: ${JSON.stringify(name)}, format: "${format}" }).catch(() => null)`);
const music = (name) => cdp.eval(`__shell.invoke("octave.debug.prop", { name: ${JSON.stringify(name)} }).catch(() => null)`);
const ls = (k) => cdp.eval(`localStorage.getItem(${JSON.stringify(k)})`);
const advancing = async (read) => { const a = await read(); await sleep(1500); const b = await read(); return [a, b, b > a]; };

// Garde-fou : jamais `mute=no` avec un volume audible, même sous le filtre à zéro.
async function guard(read, setZero, label) {
  const [mute, volume] = [await read("mute"), await read("volume")];
  if ((mute === false || mute === "no") && Number(volume) > 0) {
    await setZero();
    check(`${label} garde-fou`, false, `mute=no avec volume=${volume} : volume remis à 0`);
  }
  return { mute, volume };
}

// --- 1. Vidéo ---------------------------------------------------------------------------
console.log("== Vidéo (Banc HDR10 Pistes)");
await cdp.eval(`localStorage.setItem("tentacle_player_volume", "30"); localStorage.setItem("tentacle_player_muted", "1"); true`);
await d.playFromDetail((await findItem("Banc HDR10 Pistes")).item.Id);
await d.waitFor(async () => (await d.last("time-pos")) > 0.5, 15000);
await sleep(1500);
const vZero = () => cdp.eval(`window.tentacle.invoke("mpv_set_property", { name: "volume", value: 0 })`);
await guard(get, vZero, "vidéo");
const info = {};
for (const n of ["current-ao", "audio-device", "audio-params", "audio-out-params", "af", "mute", "volume", "aid"]) info[n] = await get(n);
for (const [k, v] of Object.entries(info)) console.log(`   ℹ︎ ${k} = ${JSON.stringify(v)}`);
check("sortie native ouverte", info["current-ao"] === "coreaudio", `current-ao = ${info["current-ao"]}`);
check("audio-params remplis", info["audio-params"]?.samplerate > 0 && info["audio-params"]?.["channel-count"] > 0,
  `${info["audio-params"]?.format} ${info["audio-params"]?.samplerate} Hz ${info["audio-params"]?.channels}`);
check("filtre de la sonde actif", JSON.stringify(info.af).includes("volume=0"), JSON.stringify(info.af));
const [p0, p1, moving] = await advancing(() => get("time-pos", "double"));
check("time-pos avance", moving, `${p0?.toFixed(2)} → ${p1?.toFixed(2)} s`);
check("restauré par le front : volume 30, sourdine", Number(info.volume) === 30 && info.mute === true, `volume=${info.volume} mute=${info.mute}`);

// Les contrôles du lecteur : la glissière de volume (0–100) et le bouton juste avant.
const slider = (v) => cdp.eval(`(() => {
  const s = [...document.querySelectorAll('input[type=range]')].find((e) => e.max === "100" && e.classList.contains("ctl-range"));
  if (!s) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(s, "${v}");
  s.dispatchEvent(new Event("input", { bubbles: true })); s.dispatchEvent(new Event("change", { bubbles: true }));
  return true; })()`);
const muteButton = () => cdp.eval(`(() => {
  const s = [...document.querySelectorAll('input[type=range]')].find((e) => e.max === "100" && e.classList.contains("ctl-range"));
  const b = s?.parentElement?.querySelector("button"); if (!b) return false; b.click(); return true; })()`);
const follows = (name, want) => d.waitFor(async () => { const v = await get(name); return v === want || Number(v) === want; }, 4000);

await d.wake();
check("glissière → 0", (await slider(0)) && (await follows("volume", 0)), `mpv volume = ${await get("volume")}, persisté ${await ls("tentacle_player_volume")}`);
await guard(get, vZero, "vidéo");
check("bouton son → sourdine levée", (await muteButton()) && (await follows("mute", false)), `mpv mute = ${await get("mute")}, persisté ${await ls("tentacle_player_muted")}`);
await guard(get, vZero, "vidéo");
check("bouton son → sourdine", (await muteButton()) && (await follows("mute", true)), `mpv mute = ${await get("mute")}, persisté ${await ls("tentacle_player_muted")}`);
await guard(get, vZero, "vidéo");
await d.key("Escape");
await sleep(2500);

// --- 2. Musique (Octave) ------------------------------------------------------------------
console.log("\n== Musique (Octave, « Lire Sans Blanc »)");
await cdp.eval(`localStorage.setItem("tentacle_octave_volume", "0");
  history.pushState({}, "", "/octave"); dispatchEvent(new PopStateEvent("popstate")); true`);
const click = (label, inDock = false) => cdp.eval(`(() => {
  const root = ${inDock} ? document.querySelector("[data-octave-dock]") : document;
  const el = [...(root?.querySelectorAll("button") ?? [])].find((b) => (b.getAttribute("aria-label") ?? b.innerText.trim()) === ${JSON.stringify(label)});
  if (!el) return false; el.click(); return true; })()`);
await d.waitFor(() => click("Lire Sans Blanc"), 15000);
await d.waitFor(async () => (await music("time-pos")) > 0.3, 15000);
const mZero = () => cdp.eval(`window.tentacle.invoke("audio_control", { action: "volume", value: 0 })`);
await guard(music, mZero, "musique");
const m = {};
for (const n of ["current-ao", "audio-device", "audio-params", "af", "mute", "volume"]) m[n] = await music(n);
for (const [k, v] of Object.entries(m)) console.log(`   ℹ︎ ${k} = ${JSON.stringify(v)}`);
check("musique : sortie native ouverte", m["current-ao"] === "coreaudio", `current-ao = ${m["current-ao"]}`);
check("musique : audio-params remplis", m["audio-params"]?.samplerate > 0, `${m["audio-params"]?.format} ${m["audio-params"]?.samplerate} Hz`);
check("musique : filtre de la sonde actif", JSON.stringify(m.af).includes("volume=0"), JSON.stringify(m.af));
const [q0, q1, qMoving] = await advancing(() => music("time-pos"));
check("musique : time-pos avance", qMoving, `${q0?.toFixed(2)} → ${q1?.toFixed(2)} s`);
// Le bouton muet d'Octave : celui qui précède la glissière « volume » (libellés traduits).
const octaveMute = () => cdp.eval(`(() => {
  const s = [...document.querySelectorAll('input[type=range]')].find((e) => /volume/i.test(e.getAttribute("aria-label") ?? ""));
  let n = s; while (n && !n.querySelector?.("button")) n = n.parentElement;
  const b = n?.querySelector("button"); if (!b) return false; b.click(); return b.getAttribute("aria-label"); })()`);
const mFollows = (name, want) => d.waitFor(async () => { const v = await music(name); return v === want || Number(v) === want; }, 4000);
// La sourdine d'abord (volume 0 : jamais audible), puis un volume SOUS sourdine.
check("musique : bouton muet → sourdine", (await octaveMute()) && (await mFollows("mute", true)), `mpv mute = ${await music("mute")}`);
if ((await music("mute")) === true) {
  await cdp.eval(`window.tentacle.invoke("audio_control", { action: "volume", value: 0.4 })`);
  check("musique : volume 40 (sous sourdine)", await mFollows("volume", 40), `mpv volume = ${await music("volume")}, mute = ${await music("mute")}`);
}
await guard(music, mZero, "musique");
await cdp.eval(`window.tentacle.invoke("audio_control", { action: "volume", value: 0 })`);
check("musique : volume 0", await mFollows("volume", 0), `mpv volume = ${await music("volume")}`);
check("musique : sourdine levée (volume 0)", (await octaveMute()) && (await mFollows("mute", false)), `mpv mute = ${await music("mute")}`);
await guard(music, mZero, "musique");
await click("Pause", true);
d.finish();
