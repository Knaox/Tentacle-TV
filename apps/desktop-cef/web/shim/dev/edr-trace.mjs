// Trace EDR d'une lecture lancée depuis l'interface de Tentacle : toutes les 0,5 s, la couche
// vidéo telle que le système la voit (`pont.debug.surface`) ; en parallèle, la sonde EXTERNE de
// vidéo-HDR donne la marge accordée. Phase 1 fenêtrée, phase 2 en plein écran (F), phase 3
// revenue en fenêtre. Sans sortir du lecteur : la seule transition est celle qu'on provoque.
//
//   node web/shim/dev/edr-trace.mjs "<titre>"     (CEF, DevTools 9303, compte connecté)
import { connect, findItem, sleep } from "./drive.mjs";

const title = process.argv[2] ?? "Banc HDR10 Pistes (2026)";
const d = await connect();
const t0 = Date.now();
const surface = () => d.cdp.eval(`window.__shell.invoke("pont.debug.surface", {}).catch(() => null)`);
async function sample(phase, seconds) {
  for (let i = 0; i < seconds * 2; i++) {
    const s = await surface();
    const pos = await d.cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "time-pos", format: "double" })`);
    console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s] ${phase} pos=${pos?.toFixed?.(1)} ` +
      (s ? `cs=${s.colorspace || "-"} fmt=${s.pixelFormat} edr=${s.wantsEdr} meta=${s.hasEdrMetadata}` : "pas de surface"));
    await sleep(500);
  }
}

await d.playFromDetail((await findItem(title)).item.Id);
await d.dismissModals();
if ((await d.cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "pause", format: "flag" })`)) === true) {
  await d.wake(); await d.key("Space");
}
console.log(`[${((Date.now() - t0) / 1000).toFixed(1).padStart(5)} s] lecture lancée : ${title}`);
await sample("fenêtré", 8);
await d.wake(); await d.key("KeyF");
await sample("plein-écran", 6);
await d.key("KeyF");
await sample("refenêtré", 5);
await d.wake(); await d.key("Escape");
d.cdp.close();
