/* eslint-disable */
// Sonde du banc de référence nav-golden — JAMAIS dans l'app : Metro l'injecte
// AVANT le module principal (`serializer.getModulesRunBeforeMainModule`, voir
// `lib/metroConfig.cjs`), pour la référence comme pour le code refactorisé.
//
// Elle écoute le focus NATIF (événements focus/blur que RN-tvOS envoie pour
// chaque vue focalisable, avec son tag) dès la première image, puis, à la
// demande du banc (CDP), remonte l'arbre React de la vue focalisée jusqu'à sa
// `focusKey` (le port de focus de la refonte : `redesign/focus/FocusTarget`).
// Indépendante des magasins de focus que la refactorisation déplace : elle ne
// lit que l'UIKit (par RN-tvOS), l'arbre React et React Navigation.
const { LogBox, TVEventHandler } = require("react-native");

// Les bandeaux de LogBox prennent le focus et masquent le haut de l'écran.
LogBox.ignoreAllLogs(true);

const state = { tag: null, seq: 0, at: Date.now(), keys: [] };

TVEventHandler.addListener((event) => {
  if (!event) return;
  if (event.eventType === "focus") {
    state.tag = event.tag;
    state.seq += 1;
    state.at = Date.now();
  } else if (event.eventType === "blur") {
    if (state.tag === event.tag) state.tag = null;
  } else {
    state.keys.push({ t: Date.now(), type: event.eventType, action: event.eventKeyAction });
    if (state.keys.length > 100) state.keys.shift();
  }
});

// ─── L'arbre React ───────────────────────────────────────────────────────────

function roots() {
  const hook = globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook || !hook.getFiberRoots) return [];
  const out = [];
  for (const id of hook.renderers ? hook.renderers.keys() : [1]) {
    for (const root of hook.getFiberRoots(id) || []) out.push(root.current);
  }
  return out;
}

/** Parcourt l'arbre (profondeur d'abord) ; `visit` rend `true` pour s'arrêter. */
function walk(fiber, visit) {
  const stack = fiber ? [fiber] : [];
  while (stack.length) {
    const node = stack.pop();
    if (visit(node)) return node;
    if (node.sibling) stack.push(node.sibling);
    if (node.child) stack.push(node.child);
  }
  return null;
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
const propsOf = (fiber) => fiber.memoizedProps || {};

function findHost(tag) {
  for (const root of roots()) {
    const hit = walk(root, (node) => typeof node.type === "string" && nativeTag(node) === tag);
    if (hit) return hit;
  }
  return null;
}

/** Les textes d'un sous-arbre (RCTRawText), dans l'ordre de lecture. */
function textsOf(fiber, limit = 12) {
  const out = [];
  const stack = fiber && fiber.child ? [fiber.child] : [];
  while (stack.length && out.length < limit) {
    const node = stack.pop();
    if (node.type === "RCTRawText" && typeof propsOf(node).text === "string") {
      const text = propsOf(node).text.replace(/\s+/g, " ").trim();
      if (text) out.push(text);
    }
    if (node.sibling) stack.push(node.sibling);
    if (node.child) stack.push(node.child);
  }
  return out;
}

/** La clé, le libellé et les groupes de la vue focalisée. */
function focusOf(tag) {
  if (tag == null) return { key: null, label: null };
  const host = findHost(tag);
  if (!host) return { key: null, label: null, tag, lost: true };
  const keys = [];
  let label = null;
  let element = null;
  for (let node = host; node; node = node.return) {
    const props = propsOf(node);
    if (label == null && typeof props.accessibilityLabel === "string" && keys.length === 0) label = props.accessibilityLabel;
    if (typeof props.focusKey === "string" && keys[keys.length - 1] !== props.focusKey) {
      keys.push(props.focusKey);
      if (!element) element = node;
    }
  }
  const text = textsOf(host).join(" · ").slice(0, 160);
  return { key: keys[0] ?? null, groups: keys.slice(1), label: label ?? (text || null), text: text || null, component: element ? null : nameOf(host.return) };
}

// ─── Navigation et Modals ────────────────────────────────────────────────────

let navRef = null;
/**
 * Le `navigationRef` de l'app, où qu'il soit rangé : la `ref` du
 * NavigationContainer dans l'arbre React (un objet qui a `getRootState`).
 * Jamais de parcours des exports des modules : lire un accesseur paresseux
 * (ceux de `react-native`) initialiserait des modules que l'app n'a pas pris.
 */
function navigation() {
  if (navRef && navRef.isReady && navRef.isReady()) return navRef;
  for (const root of roots()) {
    const hit = walk(root, (node) => node.ref && typeof node.ref === "object" && typeof node.ref.getRootState === "function");
    if (hit) {
      navRef = hit.ref;
      return navRef;
    }
  }
  return null;
}

function routeOf() {
  const ref = navigation();
  if (!ref || !ref.isReady()) return { route: null, key: null, params: null, stack: [] };
  const root = ref.getRootState();
  const routes = (root && root.routes) || [];
  const current = routes[root.index] || null;
  return {
    route: current ? current.name : null,
    key: current ? current.key : null,
    params: current && current.params ? current.params : null,
    stack: routes.map((r) => r.name),
  };
}

/** Les Modals visibles (fibre et première clé de focus qu'elle porte). */
function modalFibers() {
  const out = [];
  for (const root of roots()) {
    walk(root, (node) => {
      if (typeof node.type !== "string" && nameOf(node) === "Modal" && propsOf(node).visible !== false) out.push(node);
      return false;
    });
  }
  return out;
}
const modalsOf = (fibers) => fibers.map((node) => {
  const first = walk(node.child, (inner) => typeof propsOf(inner).focusKey === "string");
  return { key: first ? propsOf(first).focusKey : null, owner: nameOf(node.return) };
});

/** Les textes de l'écran COURANT (la scène de sa route) et des Modals ouvertes. */
function screenTexts(routeKey, modals) {
  const out = [];
  for (const root of roots()) {
    const scene = walk(root, (node) => propsOf(node).route && propsOf(node).route.key === routeKey);
    if (scene) out.push(...textsOf(scene, 6000));
  }
  for (const modal of modals) out.push(...textsOf(modal, 2000));
  return out;
}

// Le cadre de la vue focalisée, mesuré à chaque relevé (asynchrone : le relevé
// suivant rend la mesure du précédent — le banc attend qu'il soit stable).
const frame = { tag: null, value: null };
function measure(tag) {
  if (tag == null) return null;
  const { UIManager } = require("react-native");
  UIManager.measureInWindow(tag, (x, y, w, h) => {
    if (state.tag === tag) {
      frame.tag = tag;
      frame.value = [x, y, w, h].map((v) => Math.round(v));
    }
  });
  return frame.tag === tag ? frame.value : null;
}

/** Ce que le banc relève après chaque geste. */
function observe(options = {}) {
  const nav = routeOf();
  const modals = modalFibers();
  const focus = focusOf(state.tag);
  focus.frame = measure(state.tag);
  const result = {
    focus,
    focusSeq: state.seq,
    focusAgeMs: Date.now() - state.at,
    route: nav.route,
    params: nav.params,
    stack: nav.stack,
    modals: modalsOf(modals),
  };
  if (options.texts && options.texts.length) {
    const all = screenTexts(nav.key, modals);
    result.texts = options.texts.map((wanted) => all.some((text) => text.includes(wanted)));
  }
  if (options.storage && options.storage.length) {
    const { Settings } = require("react-native");
    result.storage = {};
    for (const key of options.storage) {
      const value = Settings.get(key);
      result.storage[key] = value === undefined ? null : value;
    }
  }
  return result;
}

/** Une route (`start.route` d'un scénario) : poussée sur la pile, ou pile remise à [route] (`reset`). */
function navigate(name, params, reset) {
  const ref = navigation();
  if (!ref || !ref.isReady()) return false;
  if (reset) ref.reset({ index: 0, routes: [{ name, params }] });
  else ref.navigate(name, params);
  return true;
}

/** Un geste du pavé tactile par le chemin JS de RN-tvOS (`pan`, `swipe*`) : glissé et balayage. */
function emitRemote(event) {
  const { DeviceEventEmitter } = require("react-native");
  DeviceEventEmitter.emit("onHWKeyEvent", event);
}

globalThis.__navGolden = { state, observe, navigate, emitRemote, version: 1 };
