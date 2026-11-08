// Bascules de pistes audio / sous-titres PAR L'INTERFACE du front, et ce qu'elles coûtent :
// chaque bascule est suivie 2,5 s (sondage 100 ms de `time-pos` et `demuxer-cache-state`,
// `seeking`, `paused-for-cache`, évènements mpv, spinner du lecteur `.spinner-lecture`).
// Les commandes envoyées à mpv sont dans le journal de l'app (`TENTACLE_PONT_TRACE=1`).
//
//   PONT_CDP_PORT=9313 node bench/lecteur/pistes.mjs "<titre>" [bascules=10]
import { connect, findItem, sleep } from "../../web/shim/dev/drive.mjs";

const title = process.argv[2] ?? "Banc HDR10 Pistes";
const rounds = Number(process.argv[3] ?? 10);
const d = await connect();
const { cdp, check } = d;
const get = (name, format = "int64") =>
  cdp.eval(`window.tentacle.invoke("mpv_get_property", { name: "${name}", format: "${format}" }).catch(() => null)`);

console.log(`— ${title}`);
await d.playFromDetail((await findItem(title)).item.Id);
await d.waitFor(async () => (await d.last("time-pos")) > 1, 20000);
if ((await d.last("pause")) === true) { await d.wake(); await d.key("Space"); }
await sleep(4000);  // régime établi : cache rempli, préférences de pistes appliquées

// L'enregistreur, dans la page : tout est horodaté par la même horloge.
await cdp.eval(`(() => {
  const r = (window.__rec = { props: [], events: [], polls: [] });
  const watched = new Set(["seeking", "paused-for-cache", "aid", "sid", "eof-reached"]);
  window.tentacle.on("mpv://property-change", (c) => { if (watched.has(c.name)) r.props.push({ t: Date.now(), name: c.name, data: c.data }); });
  window.tentacle.on("mpv://event", (e) => r.events.push({ t: Date.now(), event: e.event }));
  const get = (name, format) => window.tentacle.invoke("mpv_get_property", { name, format }).catch(() => null);
  r.timer = setInterval(async () => {
    const t = Date.now();
    const [pos, apts, frame, cache] = await Promise.all([get("time-pos", "double"), get("audio-pts", "double"),
      get("estimated-frame-number", "int64"), get("demuxer-cache-state", "node")]);
    const per = (type) => (cache?.["ts-per-stream"] ?? []).find((x) => x.type === type)?.["cache-duration"] ?? null;
    r.polls.push({ t, pos, apts, frame, vdur: per("video"), adur: per("audio"), fw: cache?.["fw-bytes"] ?? null,
      seeks: cache?.["debug-low-level-seeks"] ?? null, spinner: !!document.querySelector(".spinner-lecture"), path: location.pathname });
  }, 100);
  return true; })()`);

const panelOpen = () => cdp.eval(`/English/.test(document.body.innerText) && /Fran/.test(document.body.innerText)`);
async function openPanel() {
  if (await panelOpen()) return true;
  await d.wake(); await sleep(250);
  await d.clickIcon("last");  // l'engrenage : le panneau des pistes
  return d.waitFor(panelOpen, 2000);
}

// Une bascule : clic sur le libellé, 2,5 s d'observation, bilan de la fenêtre.
async function toggle(kind, i) {
  const prop = kind === "audio" ? "aid" : "sid";
  const now = await get(prop);
  const [label, want, which] = kind === "audio"
    ? (now === 2 ? ["Français", 1, "first"] : ["English", 2, "first"])
    : (now === 2 ? ["French", 1, "last"] : ["English", 2, "last"]);
  if (!(await openPanel())) return check(`${kind} #${i}`, false, "panneau des pistes introuvable");
  const t0 = await cdp.eval("Date.now()");
  const clicked = await d.clickText(label, which);
  await sleep(2500);
  const w = await cdp.eval(`(() => { const r = window.__rec, t0 = ${t0};
    const polls = r.polls.filter((p) => p.t >= t0 - 300 && p.t <= t0 + 2500);
    const before = polls.filter((p) => p.t < t0).at(-1), after = polls.filter((p) => p.t >= t0);
    let stall = 0, maxStall = 0, fStall = 0, maxF = 0, last = before, back = false, minV = Infinity, minA = Infinity, aGap = 0, aRun = 0;
    for (const p of after) {
      if (p.pos != null && last?.pos != null) {
        if (p.pos < last.pos - 0.05) back = true;
        if (p.pos <= last.pos + 0.001) stall += p.t - last.t; else stall = 0;
        maxStall = Math.max(maxStall, stall);
        // Image figée : le numéro d'image estimé n'avance plus.
        if (p.frame != null && last.frame != null && p.frame <= last.frame) fStall += p.t - last.t; else fStall = 0;
        maxF = Math.max(maxF, fStall);
        // Trou audio : audio-pts absente ou immobile pendant que la lecture avance.
        if (p.apts == null || (last.apts != null && p.apts <= last.apts + 0.001)) aRun += p.t - last.t; else aRun = 0;
        aGap = Math.max(aGap, aRun);
      }
      if (p.vdur != null) minV = Math.min(minV, p.vdur);
      if (p.adur != null) minA = Math.min(minA, p.adur);
      last = p;
    }
    return { props: r.props.filter((p) => p.t >= t0).map((p) => p.name + "=" + JSON.stringify(p.data)),
      events: r.events.filter((e) => e.t >= t0).map((e) => e.event),
      spinner: after.some((p) => p.spinner), back, stallMs: maxStall, frameStallMs: maxF, audioGapMs: aGap, path: after.at(-1)?.path,
      vBefore: before?.vdur ?? null, vMin: Number.isFinite(minV) ? minV : null, aMin: Number.isFinite(minA) ? minA : null,
      seeks: (after.at(-1)?.seeks ?? 0) - (before?.seeks ?? 0),
      pos: [before?.pos?.toFixed(2), after.at(-1)?.pos?.toFixed(2)] }; })()`);
  const got = await get(prop);
  // Cache vidéo intact : il ne baisse que de ce que la lecture a consommé (2,5 s), à 1 s près.
  const cacheKept = w.vBefore == null || w.vMin == null || w.vMin >= Math.min(w.vBefore, 25) - 3.5;
  const clean = !w.events.includes("playback-restart") && !w.events.includes("seek") && !w.props.some((p) => p === "seeking=true" || p === "paused-for-cache=true")
    && !w.spinner && !w.back && w.stallMs < 400 && cacheKept && w.path?.startsWith("/watch/") && !w.events.includes("start-file");
  const f1 = (x) => (x == null ? "?" : x.toFixed(1));
  check(`${kind} #${i} ${prop} ${now} → ${got} (« ${label} »)`, clicked && got === want && clean,
    `évènements [${w.events.join(" ")}] props [${w.props.join(" ")}] spinner=${w.spinner} recul=${w.back} gel=${w.stallMs} ms (image ${w.frameStallMs} ms) ` +
    `trou audio=${w.audioGapMs} ms pos ${w.pos.join("→")} cache vidéo ${f1(w.vBefore)} → min ${f1(w.vMin)} s, audio min ${f1(w.aMin)} s, seeks bas niveau +${w.seeks}`);
}

for (let i = 1; i <= rounds; i++) await toggle("audio", i);
// Les sous-titres repartent du début : 2 × 10 bascules de 2,5 s ne tiennent plus dans un titre
// de 60 s depuis que les bascules audio ne figent plus l'image (correctif mpv 0003).
await cdp.eval(`window.tentacle.invoke("mpv_command", { name: "seek", args: ["3", "absolute"] })`);
await sleep(4000);
for (let i = 1; i <= rounds; i++) await toggle("sub", i);
await cdp.eval("clearInterval(window.__rec.timer)");
await d.key("Escape");
await sleep(1500);
d.finish();
