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
const { makeMutable, runOnJS, runOnUI } = require("react-native-reanimated");

const FRAME = 1000 / 60;
const watchTags = makeMutable([]);
const traceOn = makeMutable(false);

function newStats() {
  "worklet";
  return { active: true, first: 0, last: 0, frames: 0, dropped: 0, hitches: 0, long: [], trace: [] };
}

function recordFrame(s, t) {
  "worklet";
  if (!s.first) s.first = t;
  if (s.last) {
    const dt = t - s.last;
    if (dt > 4) {
      s.frames += 1;
      const missed = dt > FRAME * 1.5 ? Math.round(dt / FRAME) - 1 : 0;
      if (missed > 0) {
        s.hitches += 1;
        s.dropped += missed;
        if (s.long.length < 600) s.long.push([Date.now(), Math.round(dt)]);
      }
    }
  }
  s.last = t;
}

function summarize(s) {
  "worklet";
  const elapsed = s.last - s.first;
  const slots = elapsed / FRAME;
  return {
    seconds: Math.round(elapsed) / 1000,
    frames: s.frames,
    hitches: s.hitches,
    dropped: s.dropped,
    fps60: slots > 0 ? Math.round(600 * (1 - s.dropped / slots)) / 10 : 0,
    long: s.long,
    trace: s.trace,
  };
}

function uiStart() {
  "worklet";
  const s = newStats();
  global.__perfUi = s;
  const loop = (t) => {
    if (!s.active) return;
    recordFrame(s, t);
    if (traceOn.value && s.trace.length < 6000) {
      const tags = watchTags.value;
      const row = [Date.now()];
      for (let i = 0; i < tags.length; i++) {
        const m = global._measurePaper ? global._measurePaper(tags[i]) : null;
        if (m && m.x !== -1234567) row.push(Math.round(m.pageX * 10) / 10, Math.round(m.pageY * 10) / 10, Math.round(m.width * 10) / 10, Math.round(m.height * 10) / 10);
        else row.push(null, null, null, null);
      }
      s.trace.push(row);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

let uiResult = null;
const onUiResult = (result) => {
  uiResult = result;
};
function uiStop() {
  "worklet";
  const s = global.__perfUi;
  if (!s) return;
  s.active = false;
  runOnJS(onUiResult)(summarize(s));
}

// ─── Le fil JS ───────────────────────────────────────────────────────────────

let js = null;
function jsStart() {
  const s = { active: true, first: 0, last: 0, frames: 0, dropped: 0, hitches: 0, long: [] };
  js = s;
  const loop = (t) => {
    if (!s.active) return;
    if (!s.first) s.first = t;
    if (s.last) {
      const dt = t - s.last;
      if (dt > 4) {
        s.frames += 1;
        const missed = dt > FRAME * 1.5 ? Math.round(dt / FRAME) - 1 : 0;
        if (missed > 0) {
          s.hitches += 1;
          s.dropped += missed;
          if (s.long.length < 600) s.long.push([Date.now(), Math.round(dt)]);
        }
      }
    }
    s.last = t;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function jsStop() {
  if (!js) return null;
  js.active = false;
  const elapsed = js.last - js.first;
  const slots = elapsed / FRAME;
  return { seconds: Math.round(elapsed) / 1000, frames: js.frames, hitches: js.hitches, dropped: js.dropped, fps60: slots > 0 ? Math.round(600 * (1 - js.dropped / slots)) / 10 : 0, long: js.long };
}

// ─── Le journal (fil JS) : focus, vues, événements natifs ────────────────────

const log = { armed: false, focus: [], creates: [], removes: 0, updates: 0, events: [], viewOf: new Map() };

RN.TVEventHandler.addListener((event) => {
  if (!log.armed || !event || event.eventType !== "focus") return;
  if (log.focus.length < 2000) log.focus.push([Date.now(), event.tag]);
});

(function hookUIManager() {
  const UIManager = RN.UIManager;
  const create = UIManager.createView;
  if (typeof create === "function" && !UIManager.__perfHooked) {
    // Une source d'image ou de vidéo posée (création ou changement) : `setSource`, au même journal
    // que les événements natifs — l'instant où React a DIT d'afficher ce fond, ce flux.
    const sourceSet = (tag, viewName, props) => {
      if (log.armed && props && (props.source || props.src) && /Image|Video/.test(viewName) && log.events.length < 8000) {
        log.events.push([Date.now(), tag, "setSource"]);
        // Qui est cette vue, relevé APRÈS le rendu en cours : une image d'un fondu peut être démontée avant le rapport.
        setTimeout(() => remember(tag), 0);
      }
    };
    UIManager.createView = function (tag, viewName, rootTag, props) {
      log.viewOf.set(tag, viewName);
      if (log.armed && log.creates.length < 20000) log.creates.push([Date.now(), tag, viewName]);
      sourceSet(tag, viewName, props);
      return create.apply(this, arguments);
    };
    const update = UIManager.updateView;
    UIManager.updateView = function (tag, viewName, props) {
      if (log.armed) log.updates += 1;
      sourceSet(tag, viewName, props);
      return update.apply(this, arguments);
    };
    const manage = UIManager.manageChildren;
    UIManager.manageChildren = function (tag, moveFrom, moveTo, addTags, addAt, remove) {
      if (log.armed && remove) log.removes += remove.length;
      return manage.apply(this, arguments);
    };
    UIManager.__perfHooked = true;
  }
})();

(function hookEvents() {
  const bridgeModule = require("react-native/Libraries/BatchedBridge/BatchedBridge");
  const BatchedBridge = bridgeModule.default ?? bridgeModule;
  const wrap = (emitter) => {
    if (!emitter || emitter.__perfHooked) return;
    const receive = emitter.receiveEvent;
    emitter.receiveEvent = function (tag, type) {
      // Les progressions de lecture et les défilements : trop nombreux, sans intérêt ici.
      if (log.armed && log.events.length < 8000 && !/Progress|Scroll|Layout|Buffer|Bandwidth|PlaybackRate|AudioTracks|TextTracks|VideoTracks/.test(type)) {
        log.events.push([Date.now(), tag, type]);
      }
      return receive.apply(this, arguments);
    };
    emitter.__perfHooked = true;
  };
  const existing = BatchedBridge.getCallableModule && BatchedBridge.getCallableModule("RCTEventEmitter");
  if (existing) return wrap(existing);
  const register = BatchedBridge.registerCallableModule.bind(BatchedBridge);
  BatchedBridge.registerCallableModule = (name, module) => {
    if (name === "RCTEventEmitter") wrap(module);
    return register(name, module);
  };
})();

// ─── L'arbre React (repris de navProbe, qui ne s'exporte pas) ────────────────

function roots() {
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook || !hook.getFiberRoots) return [];
  const out = [];
  for (const id of hook.renderers ? hook.renderers.keys() : [1]) {
    for (const root of hook.getFiberRoots(id) || []) out.push(root.current);
  }
  return out;
}
const nativeTag = (fiber) => {
  const node = fiber.stateNode;
  if (!node || typeof node !== "object") return null;
  return node._nativeTag ?? node.canonical?.nativeTag ?? null;
};
const nameOf = (fiber) => {
  const type = fiber.type;
  if (!type || typeof type === "string") return typeof type === "string" ? type : null;
  return type.displayName || type.name || (type.render && (type.render.displayName || type.render.name)) || (type.type && nameOf({ type: type.type })) || null;
};

/** Toutes les vues hôtes montées : tag → fibre. */
function hostIndex() {
  const index = new Map();
  for (const root of roots()) {
    const stack = root ? [root] : [];
    while (stack.length) {
      const node = stack.pop();
      if (typeof node.type === "string") {
        const tag = nativeTag(node);
        if (tag != null) index.set(tag, node);
      }
      if (node.sibling) stack.push(node.sibling);
      if (node.child) stack.push(node.child);
    }
  }
  return index;
}

/** La clé de focus la plus proche et les noms des composants au-dessus d'une vue. */
function describe(fiber, depth = 40) {
  let key = null;
  const names = [];
  for (let node = fiber, i = 0; node && i < depth; node = node.return, i++) {
    const props = node.memoizedProps || {};
    if (key == null && typeof props.focusKey === "string") key = props.focusKey;
    const name = nameOf(node);
    if (name && typeof node.type !== "string" && names[names.length - 1] !== name) names.push(name);
  }
  return { key, names };
}

/** Les vues hôtes FOCALISABLES dont la clé commence par `prefix` (au plus `max`). */
function tagsByKeyPrefix(prefix, max) {
  const out = [];
  for (const [tag, fiber] of hostIndex()) {
    const props = fiber.memoizedProps || {};
    if (!props.focusable && !props.isTVSelectable) continue;
    const { key } = describe(fiber, 12);
    if (key && key.startsWith(prefix)) out.push({ tag, key });
  }
  out.sort((a, b) => a.key.localeCompare(b.key, "en", { numeric: true }));
  return out.slice(0, max);
}

const nav = () => globalThis.__navGolden;

/** L'identité d'une vue, gardée pour le rapport même si elle est démontée entre-temps. */
const remembered = new Map();
function remember(tag) {
  if (remembered.has(tag)) return;
  const fiber = hostIndex().get(tag);
  if (fiber) remembered.set(tag, { view: log.viewOf.get(tag) ?? fiber.type, ...describe(fiber) });
}

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
    uiResult = null;
    let watched = [];
    if (mode === "trace") {
      const tag = nav() && nav().state.tag;
      if (watch) watched = tagsByKeyPrefix(watch, max);
      if (tag != null && !watched.some((w) => w.tag === tag)) watched.unshift({ tag, key: "(focus)" });
    }
    watchTags.value = watched.map((w) => w.tag);
    traceOn.value = mode === "trace";
    runOnUI(uiStart)();
    jsStart();
    const hermes = globalThis.HermesInternal && HermesInternal.getInstrumentedStats ? HermesInternal.getInstrumentedStats() : null;
    this.armedAt = Date.now();
    this.watched = watched;
    this.heapBefore = hermes ? hermes.js_heapSize : null;
    return { at: this.armedAt, watched };
  },
  disarm() {
    runOnUI(uiStop)();
    this.jsResult = jsStop();
    log.armed = false;
    return true;
  },
  ready() {
    return uiResult != null;
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
    const hermes = globalThis.HermesInternal && HermesInternal.getInstrumentedStats ? HermesInternal.getInstrumentedStats() : null;
    return {
      armedAt: this.armedAt,
      watched: this.watched,
      ui: uiResult,
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
    const hermes = globalThis.HermesInternal && HermesInternal.getInstrumentedStats ? HermesInternal.getInstrumentedStats() : null;
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
