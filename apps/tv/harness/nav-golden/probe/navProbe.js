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
const { LogBox, Platform, TVEventHandler } = require("react-native");
const ANDROID = Platform.OS === "android";

// Les bandeaux de LogBox prennent le focus et masquent le haut de l'écran.
LogBox.ignoreAllLogs(true);

const state = { tag: null, seq: 0, at: Date.now(), keys: [], reset: null };

/** Base64 → texte (UTF-8), sans dépendance. */
function fromBase64(text) {
  const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = [];
  let buffer = 0;
  let bits = 0;
  for (const char of String(text).replace(/[^A-Za-z0-9+/]/g, "")) {
    buffer = (buffer << 6) | table.indexOf(char);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(bytes.map((b) => `%${b.toString(16).padStart(2, "0")}`).join(""));
}

/**
 * L'Apple TV PHYSIQUE n'a pas de `simctl` : le banc y relance l'app de TEST
 * (`com.tentacle.mobile.navtest`, jamais celle de l'utilisateur) avec des
 * arguments `-navGoldenSession paired|none -navGoldenServer <url>
 * [-navGoldenStorage <base64 JSON>]`. Avant que l'app ne lise son stockage, la
 * sonde efface ses clés `tentacle_*` et pose la session du banc — dans le
 * domaine de l'app de test seulement. Sans ces arguments (simulateur), rien.
 */
function resetForBench() {
  // Android : le banc écrit la session dans la base de l'app avant son lancement (`lib/android.mjs`).
  if (ANDROID) return;
  const { Settings } = require("react-native");
  const session = Settings.get("navGoldenSession");
  if (typeof session !== "string") return;
  const changes = {};
  for (const key of Object.keys(Settings._settings || {})) {
    if (key.startsWith("tentacle_") || key === "disclaimer_accepted") changes[key] = null;
  }
  changes.tentacle_language = "fr";
  if (session === "paired") {
    changes.tentacle_server_url = Settings.get("navGoldenServer");
    changes.tentacle_token = "banc";
    changes.tentacle_user = JSON.stringify({ Id: "banc-user", Name: "Knaoxtest" });
  }
  const extra = Settings.get("navGoldenStorage");
  if (typeof extra === "string" && extra) Object.assign(changes, JSON.parse(fromBase64(extra)));
  Settings.set(changes);
  state.reset = { session, cleared: Object.keys(changes).length, at: Date.now() };
}
resetForBench();

function focused(tag) {
  state.tag = tag;
  state.seq += 1;
  state.at = Date.now();
}

TVEventHandler.addListener((event) => {
  if (!event) return;
  if (event.eventType === "focus") {
    focused(event.tag);
  } else if (event.eventType === "blur") {
    if (state.tag === event.tag) state.tag = null;
  } else {
    state.keys.push({ t: Date.now(), type: event.eventType, action: event.eventKeyAction });
    if (state.keys.length > 100) state.keys.shift();
  }
});

/**
 * Android : le focus/blur de `TVEventHandler` ne vient que de la fenêtre de
 * l'activité ; celui d'une `Modal` (sa fenêtre de `Dialog`) n'y passe pas. Les
 * événements React `topFocus` / `topBlur` que chaque vue envoie
 * (`ReactViewGroup.onFocusChanged`) passent, eux, par `RCTEventEmitter` —
 * quelle que soit la fenêtre : on les écoute là, sans rien changer à leur
 * livraison.
 */
/** Pour chaque vue focalisée (Android), celle qui avait le focus juste avant. */
const previous = new Map();

function hookReactFocusEvents() {
  const bridgeModule = require("react-native/Libraries/BatchedBridge/BatchedBridge");
  const BatchedBridge = bridgeModule.default ?? bridgeModule;
  const wrap = (emitter) => {
    if (!emitter || emitter.__navGoldenHooked) return;
    const receive = emitter.receiveEvent;
    emitter.receiveEvent = function (tag, type, event) {
      if (type === "topFocus") {
        if (state.tag !== tag) previous.set(tag, state.tag);
        focused(tag);
      } else if (type === "topBlur" && state.tag === tag) {
        // Une Modal fermée : la fenêtre de l'activité rend le focus à la vue qui
        // l'avait (la carte), SANS événement. On y revient si elle est montée ;
        // un vrai déplacement envoie aussitôt le focus suivant.
        const before = previous.get(tag);
        state.tag = before != null && findHost(before) ? before : null;
      }
      return receive.apply(this, arguments);
    };
    emitter.__navGoldenHooked = true;
  };
  const existing = BatchedBridge.getCallableModule && BatchedBridge.getCallableModule("RCTEventEmitter");
  if (existing) return wrap(existing);
  const register = BatchedBridge.registerCallableModule.bind(BatchedBridge);
  BatchedBridge.registerCallableModule = (name, module) => {
    if (name === "RCTEventEmitter") wrap(module);
    return register(name, module);
  };
}
if (ANDROID) hookReactFocusEvents();

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
    // Un texte de React Native est une fibre HOTE TEXTE (tag 6) dont les props sont la chaîne.
    const raw = node.tag === 6 && typeof node.memoizedProps === "string" ? node.memoizedProps
      : node.type === "RCTRawText" && typeof propsOf(node).text === "string" ? propsOf(node).text : null;
    if (raw) {
      const text = raw.replace(/\s+/g, " ").trim();
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
  // Une Modal en enveloppe une autre du même nom (composant et classe) : on garde la plus haute.
  const inside = (node) => {
    for (let up = node.return; up; up = up.return) if (out.includes(up)) return true;
    return false;
  };
  return out.filter((node) => !inside(node));
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

/**
 * Le stockage relu sur Android : AsyncStorage est asynchrone — le relevé rend
 * la lecture du relevé précédent (le banc attend un relevé stable).
 */
const storageMirror = {};
function readStorage(keys) {
  if (!ANDROID) {
    const { Settings } = require("react-native");
    const out = {};
    for (const key of keys) {
      const value = Settings.get(key);
      out[key] = value === undefined ? null : value;
    }
    return out;
  }
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  AsyncStorage.multiGet(keys).then((pairs) => pairs.forEach(([k, v]) => { storageMirror[k] = v === undefined ? null : v; }), () => {});
  const out = {};
  for (const key of keys) out[key] = key in storageMirror ? storageMirror[key] : null;
  return out;
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
    // La largeur de la fenêtre : le banc ramène le cadre à l'échelle de la référence (Android en dp).
    window: { width: require("react-native").Dimensions.get("window").width },
  };
  // Android : l'app renvoyée derrière l'accueil (Retour à la racine) garde son JS
  // vivant — la sonde répond encore ; elle dit donc son état.
  if (ANDROID) result.appState = require("react-native").AppState.currentState;
  if (options.texts && options.texts.length) {
    const all = screenTexts(nav.key, modals);
    result.texts = options.texts.map((wanted) => all.some((text) => text.includes(wanted)));
  }
  if (options.storage && options.storage.length) result.storage = readStorage(options.storage);
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
