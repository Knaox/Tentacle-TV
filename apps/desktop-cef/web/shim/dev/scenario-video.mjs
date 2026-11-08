// Scénario de bout en bout DANS le front de Tentacle, par ses propres contrôles :
// lecture, pause, seek, piste audio, sous-titres, plein écran, fin, retour.
// N'observe QUE par `window.tentacle.on` : marche contre le faux natif (Chrome du
// pont) comme contre le vrai (CEF, DevTools 9303). Le compte doit être connecté.
//
//   node web/shim/dev/scenario-video.mjs "<titre du film>"
import { connect, findItem, sleep } from "./drive.mjs";

const title = process.argv[2] ?? "Banc Pistes SDR";
console.log(`— ${title}`);
const d = await connect();
const { cdp, check, key, wake, last, clickText, dismissModals } = d;
const waitFor = (_label, fn, ms) => d.waitFor(fn, ms);

// Le parcours d'un utilisateur : la fiche du film, puis « Lecture » — le retour du
// lecteur (`navigate(-1)`) reste alors dans le même document. Sonde branchée ensuite.
await d.playFromDetail((await findItem(title)).item.Id);
await sleep(1500);
await dismissModals();
// Ce qui a changé AVANT la sonde (une modale qui met en pause) : relu une fois.
await cdp.eval(`(async () => { for (const [n, f] of [["pause", "flag"], ["time-pos", "double"]]) {
  const v = await window.tentacle.invoke("mpv_get_property", { name: n, format: f });
  if (!(n in window.__probe.props)) window.__probe.props[n] = v; } })()`);
check("pont présent", await cdp.eval("typeof window.tentacle === 'object' && window.tentacle.capabilities.includes('mpv_init')"), "window.tentacle + mpv_init annoncé");

// Reprise par l'interface (Espace) si une modale a mis en pause.
if ((await last("pause")) === true) { await wake(); await key("Space"); }
const pos0 = await waitFor("time-pos avance", async () => { const p = await last("time-pos"); await sleep(600); return (await last("time-pos")) > p; }, 15000);
check("lecture démarrée", pos0, `time-pos = ${await last("time-pos")}, pause = ${await last("pause")}`);

await sleep(3000);  // MoltenVK pose espace colorimétrique et EDR après les premières images
// Ce que mpv dit du signal et de la sortie (lectures ASYNCHRONES, par la porte de la page), et la
// couche vue par Core Animation (canal de diagnostic du socle, absent du faux natif).
const hdr = await cdp.eval(`(async () => {
  const get = (name, format = "string") => window.tentacle.invoke("mpv_get_property", { name, format }).catch(() => null);
  const out = {};
  for (const n of ["video-params/gamma", "video-params/primaries", "video-params/colormatrix", "video-params/sig-peak",
                   "video-target-params/gamma", "video-target-params/primaries", "hwdec-current", "current-vo", "current-gpu-context", "current-ao", "mute"]) out[n] = await get(n);
  if (window.__shell?.invoke) {
    const layers = await window.__shell.invoke("shell.debug.layers", {}).catch(() => null);
    const text = typeof layers === "string" ? layers : JSON.stringify(layers ?? "");
    out.surface = await window.__shell.invoke("pont.debug.surface", {}).catch(() => null);
    out.layers = text.split(String.fromCharCode(10)).filter((l) => /Metal|PQ|2100|EDR/i.test(l)).slice(0, 4);
  }
  return out; })()`);
for (const [k, v] of Object.entries(hdr)) console.log(`   ℹ︎ ${k} = ${JSON.stringify(v)}`);

await wake(); await key("Space");
check("pause (Espace)", await waitFor("pause", async () => (await last("pause")) === true), `pause = ${await last("pause")}`);
await key("Space");
check("reprise (Espace)", await waitFor("reprise", async () => (await last("pause")) === false), `pause = ${await last("pause")}`);

const before = (await last("time-pos")) ?? 0;
await key("ArrowRight");
const after = await waitFor("seek", async () => { const p = await last("time-pos"); return p > before + 25 ? p : null; });
check("seek +30 (→)", after !== null, `${before.toFixed(1)} s → ${after?.toFixed?.(1)} s, playback-restart vus : ${await cdp.eval("window.__probe.events.filter((e) => e.event === 'playback-restart').length")}`);

await dismissModals();  // sous CEF, « Nouveautés » arrive tard et capte les clics
await wake(); await sleep(300);
await d.clickIcon("last");  // l'engrenage : le panneau des pistes
await sleep(600);
const panel = await cdp.eval("document.body.innerText");
check("panneau des pistes", /English/.test(panel) && /Fran/.test(panel), "pistes audio fra/eng listées depuis track-list");
// Le front MÉMORISE le choix de pistes (préférences du compte) : viser l'AUTRE piste que la courante.
const pick = (name) => cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "${name}", format: "int64" })`);
const aidNow = await pick("aid");
const [audioLabel, audioWant] = aidNow === 2 ? ["Français", 1] : ["English", 2];
await clickText(audioLabel);
check(`piste audio → ${audioLabel}`, await waitFor("aid", async () => (await last("aid")) === audioWant), `aid ${aidNow} → ${await last("aid")}`);
await sleep(400);
// Sous-titres : « French - … » / « English » — l'audio anglais (« English - AAC ») vient AVANT, d'où « last ».
const sidNow = await pick("sid");
const [subLabel, subWant] = sidNow === 2 ? ["French", 1] : ["English", 2];
const subOk = await clickText(subLabel, "last");
check(`sous-titres → ${subLabel}`, subOk && (await waitFor("sid", async () => (await last("sid")) === subWant)), `sid ${sidNow} → ${await last("sid")}`);

await dismissModals();
await wake(); await key("KeyF");
const fsOn = await waitFor("plein écran", () => cdp.eval("window.__probe.fullscreen.at(-1) === true"));
await key("KeyF");
const fsOff = await waitFor("fenêtré", () => cdp.eval("window.__probe.fullscreen.at(-1) === false"));
check("plein écran (F) aller-retour", fsOn && fsOff, `window://fullscreen : ${await cdp.eval("JSON.stringify(window.__probe.fullscreen)")}`);

for (let i = 0; i < 5; i++) { await key("ArrowRight"); await sleep(300); }
const eof = await waitFor("fin", async () => (await last("eof-reached")) === true, 10000);
check("fin de fichier", eof, `eof-reached = ${await last("eof-reached")}, page : ${await cdp.eval("location.pathname")}`);
await sleep(1500);

const route = await cdp.eval("location.pathname");
if (route.startsWith("/watch/")) { await wake(); await key("Escape"); }
const left = await waitFor("retour", async () => !(await cdp.eval("location.pathname")).startsWith("/watch/"), 8000);
const ended = await cdp.eval("window.__probe.events.map((e) => e.event + (e.reason !== undefined ? '(' + e.reason + ')' : '')).join(' ')");
check("retour hors du lecteur", left, `page : ${await cdp.eval("location.pathname")} ; évènements : ${ended}`);

d.finish();
