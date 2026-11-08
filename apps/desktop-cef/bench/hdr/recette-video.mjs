// Recette vidéo d'UN titre dans l'app CEF (lancée par scripts/recette.sh) : marge EDR lue par
// la sonde EXTERNE, fenêtré puis plein écran, page de Tentacle au-dessus (contrôles affichés),
// et le plein écran prouvé par trois témoins indépendants : SDL (`shell.window.state`), la
// NSWindow elle-même (`pont.debug.surface`.window) et le serveur de fenêtres (win-state).
//
//   node bench/hdr/recette-video.mjs "<titre>" hdr|sdr
// Environnement : PONT_CDP_PORT, RECETTE_APP_PID, EDR_PROBE, WIN_STATE.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const run = promisify(execFile);
const [title = "Banc Pistes SDR (2026)", kind = "sdr"] = process.argv.slice(2);
const hdr = kind === "hdr";
const pid = process.env.RECETTE_APP_PID;

/** Marge EDR de l'écran 0 sur `s` secondes : { min, max }. */
async function edr(s) {
  const { stdout } = await run(process.env.EDR_PROBE, ["--hz", "10", "--duration", String(s)]);
  const m = stdout.match(/summary min=([\d.]+) max=([\d.]+)/);
  return m ? { min: Number(m[1]), max: Number(m[2]) } : { min: NaN, max: NaN };
}
/** La rémanence de l'EDR (~15 s) : attendre que l'écran soit revenu à 1,00. */
async function reference(ms = 30000) {
  const end = Date.now() + ms;
  let v;
  do { v = await edr(2); if (v.max <= 1.001) return v; } while (Date.now() < end);
  return v;
}
const win = async () => JSON.parse((await run(process.env.WIN_STATE, [pid])).stdout);
const fmt = (v) => `min ${v.min.toFixed(2)} max ${v.max.toFixed(2)}`;
const edrOk = (v) => (hdr ? v.max > 1.05 : v.max <= 1.001);
const want = hdr ? "> 1" : "= 1,00";

const ref = await reference();
console.log(`— ${title} (${kind})`);
const d = await connect();
const { cdp, check, key, wake, last } = d;
const shell = (ch) => cdp.eval(`window.__shell.invoke(${JSON.stringify(ch)}, {}).catch((e) => ({ error: String(e) }))`);
check("référence avant lecture = 1,00", ref.max <= 1.001, fmt(ref));

await d.playFromDetail((await findItem(title)).item.Id);
await sleep(1500);
await d.dismissModals();
if ((await last("pause")) === true) { await wake(); await key("Space"); }
const playing = await d.waitFor(async () => { const a = await last("time-pos"); await sleep(600); return (await last("time-pos")) > a; }, 15000);
check("lecture démarrée", playing, `time-pos = ${await last("time-pos")}, mute = ${await cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "mute", format: "string" }).catch(() => null)`)}`);
await sleep(4000);  // MoltenVK pose espace colorimétrique et EDR après les premières images

/** Les TentacleVideoLayer de l'arbre Core Animation réel : [{ hidden, opaque, w, h }]. */
async function videoLayers() {
  const t = await shell("shell.debug.layers");
  return String(t).split("\n").filter((l) => l.includes("TentacleVideoLayer")).map((l) => {
    const m = l.match(/hidden=(\d) opaque=(\d) frame=\{\{([-\d.]+), ([-\d.]+)\}, \{([\d.]+), ([\d.]+)\}\}/) ?? [];
    return { hidden: m[1] === "1", opaque: m[2] === "1", w: Number(m[5]), h: Number(m[6]) };
  });
}
/** Ce que la couche vidéo dit d'elle-même (témoin interne). */
async function surface(label) {
  const s = await shell("pont.debug.surface");
  const ok = hdr ? /2100_PQ/.test(s?.colorspace) && s?.pixelFormat === "BGR10A2Unorm" && s?.wantsEdr === true
                 : s?.wantsEdr === false && !/2100/.test(s?.colorspace ?? "");
  check(`témoin interne ${label}`, ok, JSON.stringify({ cs: s?.colorspace, fmt: s?.pixelFormat, edr: s?.wantsEdr, meta: s?.hasEdrMetadata, px: s?.pixelSize }));
  console.log(`   ℹ︎ couches vidéo ${label} = ${JSON.stringify(await videoLayers())}`);
  return s;
}

// La fenêtre doit être À L'ÉCRAN (et pas dans un autre espace) avant toute mesure fenêtrée.
const shown = await d.waitFor(async () => (await win()).windows.some((w) => w.layer === 0 && w.onscreen), 10000);
if (!shown) console.log("   ℹ︎ fenêtre absente de l'écran courant après 10 s (autre espace ?)");
await wake();  // les contrôles du lecteur (la page web) par-dessus la vidéo
const w1 = await edr(5);
check(`EDR fenêtré, page au-dessus ${want}`, edrOk(w1), fmt(w1));
await surface("fenêtré");
const ws1 = await win();
check("fenêtre sur l'écran sondé (écran 0)", ws1.windows.some((w) => w.layer === 0 && w.x < ws1.screen.w), JSON.stringify(ws1.windows.filter((w) => w.layer === 0)));

await wake(); await key("KeyF");
const fsEvent = await d.waitFor(() => cdp.eval("window.__probe.fullscreen.at(-1) === true"), 8000);
await sleep(2000);  // l'animation d'entrée dans l'espace plein écran
const st = await shell("shell.window.state");
const s2 = await shell("pont.debug.surface");
const ws2 = await win();
// Le plein écran natif s'arrête sous l'encoche : la surface attendue est l'écran moins safeTop.
const scr = { w: ws2.screen.w, h: ws2.screen.h - (ws2.screen.safeTop ?? 0) };
check("plein écran : évènement window://fullscreen", fsEvent, JSON.stringify(await cdp.eval("window.__probe.fullscreen")));
check("plein écran : SDL (taille = écran)", st?.fullscreen && st.width === scr.w && st.height === scr.h, `SDL ${st?.width}×${st?.height} fs=${st?.fullscreen}, attendu ${scr.w}×${scr.h} (écran ${ws2.screen.w}×${ws2.screen.h}, encoche ${ws2.screen.safeTop} pt)`);
if (s2 && s2.window === undefined) console.log("   ℹ︎ plein écran : NSWindow — témoin absent de cette app (pont.debug.surface sans « window »)");
else check("plein écran : NSWindow (styleMask)", s2?.window?.fullscreen === true, JSON.stringify(s2?.window));
check("plein écran : serveur de fenêtres", ws2.fullscreen, JSON.stringify(ws2.windows.filter((w) => w.layer === 0)));
const scale = st?.scale ?? 2;
const vl = (await videoLayers()).filter((l) => !l.hidden);
check("plein écran : couche vidéo à la taille", vl.length === 1 && vl[0].w === scr.w && vl[0].h === scr.h
      && s2?.pixelSize?.[0] === Math.round(scr.w * scale) && s2?.pixelSize?.[1] === Math.round(scr.h * scale),
      `couche ${JSON.stringify(vl)}, swapchain ${JSON.stringify(s2?.pixelSize)} (attendu ${scr.w}×${scr.h} pt × ${scale})`);
await wake();
const f1 = await edr(5);
check(`EDR plein écran, page au-dessus ${want}`, edrOk(f1), fmt(f1));
await surface("plein écran");

await wake(); await key("KeyF");
const back = await d.waitFor(() => cdp.eval("window.__probe.fullscreen.at(-1) === false"), 8000);
await sleep(2000);
const st2 = await shell("shell.window.state");
const ws3 = await win();
check("sortie du plein écran", back && !st2?.fullscreen && !ws3.fullscreen && st2.width < scr.w, `SDL ${st2?.width}×${st2?.height} fs=${st2?.fullscreen}`);

if ((await d.path()).startsWith("/watch/")) { await wake(); await key("Escape"); }
const left = await d.waitFor(async () => !(await d.path()).startsWith("/watch/"), 8000);
check("retour hors du lecteur", left, `page ${await d.path()}, surface ${JSON.stringify(await shell("pont.debug.surface"))}`);
d.finish();
