/* eslint-disable */
// Sonde de FLUIDITÉ du banc nav-golden (lot tvgrille, 18/10) — JAMAIS dans
// l'app : chargée par `appEntry.js` après la sonde de navigation, elle ne fait
// RIEN tant que le banc ne l'arme pas (`globalThis.__perf.arm()` par CDP).
//
// Armée, elle relève :
// - les images du FIL D'INTERFACE (requestAnimationFrame du runtime UI de
//   Reanimated, battu par le CADisplayLink) et du fil JS — accrocs, images
//   perdues ramenées à 60 Hz, pires écarts ;
// - en mode `trace`, à chaque image du fil UI, le cadre (`_measurePaper`) des
//   vues suivies : la vue focalisée et ses voisines de même famille de clé
//   (`grid:`, `nextUp:`…) — un cadre qui bouge sans geste est un SAUT ;
// - côté JS, horodatés à la même horloge (Date.now) : chaque focus natif,
//   chaque vue créée (`UIManager.createView`, par classe), mise à jour ou
//   retirée, et chaque événement natif (`RCTEventEmitter.receiveEvent` :
//   chargement d'image, première image d'une vidéo…) avec son tag.
// `report()` rend le tout, les tags d'intérêt rattachés à leurs composants.
const RN = require("react-native");
const { watchTags, traceOn, startUi, stopUi, uiReport, resetUi, jsStart, jsStop } = require("./perf/frames");
const { log, hostIndex, describe, tagsByKeyPrefix, remembered } = require("./perf/journal");

const nav = () => globalThis.__navGolden;
const hermesStats = () => (globalThis.HermesInternal && HermesInternal.getInstrumentedStats ? HermesInternal.getInstrumentedStats() : null);

globalThis.__perf = {
  /** `mode` : "fps" (images seules) ou "trace" (cadres des vues suivies). `watch` : préfixe de clé à suivre. */
  arm(mode = "fps", watch = null, max = 14) {
    log.armed = true;
    log.focus = [];
    log.creates = [];
    log.removes = 0;
    log.updates = 0;
    log.events = [];
    remembered.clear();
    resetUi();
    let watched = [];
    if (mode === "trace") {
      const tag = nav() && nav().state.tag;
      if (watch) watched = tagsByKeyPrefix(watch, max);
      if (tag != null && !watched.some((w) => w.tag === tag)) watched.unshift({ tag, key: "(focus)" });
    }
    watchTags.value = watched.map((w) => w.tag);
    traceOn.value = mode === "trace";
    startUi();
    jsStart();
    const hermes = hermesStats();
    this.armedAt = Date.now();
    this.watched = watched;
    this.heapBefore = hermes ? hermes.js_heapSize : null;
    return { at: this.armedAt, watched };
  },
  disarm() {
    stopUi();
    this.jsResult = jsStop();
    log.armed = false;
    return true;
  },
  ready() {
    return uiReport() != null;
  },
  report() {
    const index = hostIndex();
    const tags = new Set([...log.focus.map((f) => f[1]), ...log.events.map((e) => e[1])]);
    const about = {};
    for (const tag of tags) {
      const fiber = index.get(tag);
      about[tag] = remembered.get(tag) ?? { view: log.viewOf.get(tag) ?? (fiber ? fiber.type : null), ...(fiber ? describe(fiber) : { key: null, names: [], gone: true }) };
    }
    const byClass = {};
    for (const [, , name] of log.creates) byClass[name] = (byClass[name] || 0) + 1;
    const hermes = hermesStats();
    return {
      armedAt: this.armedAt,
      watched: this.watched,
      ui: uiReport(),
      js: this.jsResult,
      focus: log.focus,
      events: log.events,
      creates: log.creates.filter((c) => /Video|Image|Preview/i.test(c[2])),
      createsByClass: byClass,
      createsTotal: log.creates.length,
      updates: log.updates,
      removes: log.removes,
      about,
      heap: { before: this.heapBefore, after: hermes ? hermes.js_heapSize : null },
    };
  },
  /** La mémoire du runtime JS, tout de suite (sans armer). */
  heap() {
    const hermes = hermesStats();
    return hermes ? { heap: hermes.js_heapSize, allocated: hermes.js_allocatedBytes, gcs: hermes.js_numGCs } : null;
  },
  /** Les vues hôtes montées par classe (vidéos, images) : le lecteur unique se voit ici. */
  mounted(pattern = "Video") {
    const re = new RegExp(pattern, "i");
    const out = [];
    for (const [tag, fiber] of hostIndex()) if (re.test(String(fiber.type))) out.push({ tag, type: fiber.type, ...describe(fiber, 25) });
    return out;
  },
  version: 1,
};
