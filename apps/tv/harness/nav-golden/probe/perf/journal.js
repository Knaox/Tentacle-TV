/* eslint-disable */
// Le JOURNAL de la sonde de fluidité (`../perfProbe.js`), sur le fil JS et à
// l'horloge Date.now : focus natifs, vues créées / mises à jour / retirées
// (`UIManager`, par classe), sources d'image et de vidéo posées, événements
// natifs (`RCTEventEmitter`) ; et l'arbre React pour dire QUI est une vue.
const RN = require("react-native");

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


/** L'identité d'une vue, gardée pour le rapport même si elle est démontée entre-temps. */
const remembered = new Map();
function remember(tag) {
  if (remembered.has(tag)) return;
  const fiber = hostIndex().get(tag);
  if (fiber) remembered.set(tag, { view: log.viewOf.get(tag) ?? fiber.type, ...describe(fiber) });
}

module.exports = { log, hostIndex, describe, tagsByKeyPrefix, remembered };
