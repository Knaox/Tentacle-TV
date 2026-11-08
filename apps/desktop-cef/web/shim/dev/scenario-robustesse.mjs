// Robustesse du lecteur à travers le pont, dans le front de Tentacle :
//   A. média introuvable (fichier retiré après indexation) → écran d'erreur, « Retour à la fiche » ;
//   B. un film lisible juste après : le pont s'en est remis ;
//   C. fin d'un épisode → l'épisode suivant s'enchaîne (nouvelle instance) et joue ;
//   D. « Retour » en pleine lecture → hors du lecteur, plus de lecteur côté natif.
// Même conduite que `scenario-video.mjs` (faux natif ou CEF). Médias du banc :
// « Banc Disparu (2026) », « Banc Pistes SDR (2026) », série « Banc Série » (3 × 20 s).
//
//   node web/shim/dev/scenario-robustesse.mjs
import { connect, findItem, sleep } from "./drive.mjs";

const d = await connect();
const { cdp, check } = d;
const get = (name, format) => cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "${name}", format: "${format}" }).catch(() => null)`);
/** `time-pos` avance-t-il (lecture réelle, pas seulement une fiche ouverte) ? */
async function advancing() {
  const a = await get("time-pos", "double");
  await sleep(1200);
  const b = await get("time-pos", "double");
  return typeof a === "number" && typeof b === "number" && b > a ? `${a.toFixed(1)} → ${b.toFixed(1)} s` : null;
}
/** Une modale tardive ou le pré-remplissage peuvent tenir la pause : la lever par l'interface. */
async function ensurePlaying() {
  await d.dismissModals();
  if ((await get("pause", "flag")) === true) { await d.wake(); await d.key("Space"); }
  return d.waitFor(advancing, 15000);
}

// A — média introuvable
const missing = (await findItem("Banc Disparu (2026)")).item;
await d.playFromDetail(missing.Id);
const errorShown = await d.waitFor(async () => /n'a pas pu démarrer/.test(await d.text()) ? (await d.text()).match(/Le fichier[^\n]*/)?.[0] ?? "écran d'erreur" : null, 20000);
check("A. média introuvable → écran d'erreur du front", errorShown, `« ${errorShown} »`);
await d.clickText("Retour à la fiche");
const backA = await d.waitFor(async () => (await d.path()) === `/media/${missing.Id}`, 8000);
check("A. « Retour à la fiche »", backA, `page : ${await d.path()}`);

// B — un film lisible juste après
await d.playFromDetail((await findItem("Banc Pistes SDR (2026)")).item.Id);
const playsB = await ensurePlaying();
check("B. lecture suivante après l'erreur", playsB, `time-pos ${playsB}`);
await d.wake(); await d.key("Escape");
await d.waitFor(async () => !(await d.path()).startsWith("/watch/"), 8000);

// C — fin d'épisode → épisode suivant
const { items: episodes } = await findItem("Banc Série", "Episode");
await d.playFromDetail(episodes[0].Id);
const playsE1 = await ensurePlaying();
check("C. épisode 1 joue", playsE1, `time-pos ${playsE1}`);
await d.wake(); await d.key("ArrowRight");  // +30 s sur 20 s : la fin
const onE2 = await d.waitFor(async () => (await d.path()) === `/watch/${episodes[1].Id}`, 30000);
check("C. fin de l'épisode 1 → épisode 2", onE2, `page : ${await d.path()} ; titre : ${(await d.text()).match(/S01E0\d/)?.[0]}`);
const playsE2 = onE2 && (await ensurePlaying());
check("C. épisode 2 joue (nouvelle instance)", playsE2, `time-pos ${playsE2}`);

// D — « Retour » en pleine lecture
await d.wake(); await sleep(300);
await d.clickIcon("first");  // la flèche de retour, en haut à gauche
const left = await d.waitFor(async () => !(await d.path()).startsWith("/watch/"), 8000);
await sleep(1500);
const after = await get("time-pos", "double");
check("D. « Retour » en lecture → hors du lecteur, lecteur arrêté", left && after === null, `page : ${await d.path()} ; time-pos natif : ${after}`);

d.finish();
