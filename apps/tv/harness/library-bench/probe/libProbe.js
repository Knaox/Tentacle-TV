// La sonde du banc des bibliothèques — JAMAIS dans l'app : l'enveloppe Metro
// du banc (`../metro.config.js`) la substitue à `src/utils/screenMetricsDiag`,
// qu'index.js importe, et elle le réimporte en fin de fichier. Elle marche en
// JS de production (aucun nom de module ni arbre de fibres à chercher).
//
// Ce qu'elle relève, seulement armée (`__libProbe.arm(label)`) :
// - les images/s des fils d'interface et JS (`frameMeter.js`) ;
// - chaque affiche : montage, chargement (onLoad), démontage, avec l'heure ;
// - la position de la grille et ses lignes (FlatList ou FlashList), de quoi
//   savoir quelles affiches étaient À L'ÉCRAN, et vides ;
// - l'instant où la navigation change de route (l'ouverture d'une bibliothèque) ;
// - la position de la page à CHAQUE image du fil d'interface, le focus et la
//   télécommande (`scrollTrace.js`) : les creux de vitesse.
// Horloge : Date.now(), celle du Mac — la même que le journal du faux serveur.
const React = require("react");
const RN = require("react-native");
const { createUiMeter, startJsMeter } = require("./frameMeter");

const P = {
  armed: false, label: "", armedAt: 0,
  imgs: [], scroll: [], marks: [], data: [],
  ui: null, js: null,
  lists: new Map(),
  flash: new Set(),
  // Les affiches montées en ce moment (armée ou non) : recopiées à l'armement.
  live: new Map(),
  nextImg: 1, nextList: 1,
};
globalThis.__libProbe = P;

// Les statiques (prefetch, getSize…), jamais `render` ni `$$typeof` : un
// forwardRef recopié sur un autre en prendrait le rendu.
function copyStatics(to, from) {
  for (const k of Object.keys(from)) if (k !== "$$typeof" && k !== "render" && k !== "displayName") to[k] = from[k];
}

// ── Les affiches : l'Image de React Native, enveloppée ─────────────────────
const OrigImage = RN.Image;
const isPoster = (uri) => typeof uri === "string" && uri.includes("/Images/Primary");
const ProbeImage = React.forwardRef(function ProbeImage(props, ref) {
  const id = React.useRef(0);
  if (!id.current) id.current = P.nextImg++;
  const uri = props.source && props.source.uri;
  const poster = isPoster(uri);
  React.useEffect(() => {
    if (!poster) return undefined;
    const me = id.current;
    P.live.set(me, { uri, loaded: false });
    if (P.armed) P.imgs.push([Date.now(), "m", me, uri]);
    return () => {
      P.live.delete(me);
      if (P.armed) P.imgs.push([Date.now(), "x", me, uri]);
    };
  }, [uri, poster]);
  const { onLoad: userOnLoad, onError: userOnError } = props;
  const onLoad = React.useCallback((e) => {
    const live = P.live.get(id.current);
    if (live && live.uri === uri) live.loaded = true;
    if (P.armed) P.imgs.push([Date.now(), "l", id.current, uri]);
    if (userOnLoad) userOnLoad(e);
  }, [uri, userOnLoad]);
  const onError = React.useCallback((e) => {
    if (P.armed) P.imgs.push([Date.now(), "e", id.current, uri]);
    if (userOnError) userOnError(e);
  }, [uri, userOnError]);
  return React.createElement(OrigImage, poster ? { ...props, ref, onLoad, onError } : { ...props, ref });
});
copyStatics(ProbeImage, OrigImage);
ProbeImage.displayName = "Image";
Object.defineProperty(RN, "Image", { configurable: true, enumerable: true, get: () => ProbeImage });

// ── FlatList : enveloppée (défilement, lignes) ──────────────────────────────
const OrigFlatList = RN.FlatList;
const ProbeFlatList = React.forwardRef(function ProbeFlatList(props, ref) {
  const inner = React.useRef(null);
  const listId = React.useRef(0);
  if (!listId.current) listId.current = P.nextList++;
  React.useEffect(() => {
    const id = listId.current;
    P.lists.set(id, { inner, props });
    return () => { P.lists.delete(id); };
  });
  const lines = props.data ? props.data.length : 0;
  React.useEffect(() => {
    if (P.armed) P.data.push([Date.now(), listId.current, lines]);
  }, [lines]);
  const setRef = React.useCallback((r) => {
    inner.current = r;
    if (typeof ref === "function") ref(r);
    else if (ref) ref.current = r;
  }, [ref]);
  const userOnScroll = props.onScroll;
  const onScroll = React.useCallback((e) => {
    if (P.armed) P.scroll.push([Date.now(), listId.current, Math.round(e.nativeEvent.contentOffset.y)]);
    if (userOnScroll) userOnScroll(e);
  }, [userOnScroll]);
  return React.createElement(OrigFlatList, { ...props, ref: setRef, onScroll });
});
copyStatics(ProbeFlatList, OrigFlatList);
Object.defineProperty(RN, "FlatList", { configurable: true, enumerable: true, get: () => ProbeFlatList });

// ── FlashList : ses exports ne se redéfinissent pas — le prototype, oui ─────
try {
  const FL = require("@shopify/flash-list").FlashList;
  const { componentDidMount: didMount, componentWillUnmount: willUnmount } = FL.prototype;
  FL.prototype.componentDidMount = function probeDidMount(...args) {
    P.flash.add(this);
    return didMount ? didMount.apply(this, args) : undefined;
  };
  FL.prototype.componentWillUnmount = function probeWillUnmount(...args) {
    P.flash.delete(this);
    return willUnmount ? willUnmount.apply(this, args) : undefined;
  };
} catch (e) {
  P.flashError = String(e);
}
const FLASH_LIST_ID = 999;
const isGridData = (data) => !!(data && data[0] && data[0].cards);
/** La grille recyclée (des lignes de cartes) ; son RecyclerListView est `rlvRef`. */
function flashGrid() {
  for (const inst of P.flash) if (inst.props && isGridData(inst.props.data) && inst.rlvRef) return inst;
  return null;
}
/** La grille FlatList : celle dont les données sont des lignes de cartes. */
function flatGrid() {
  for (const { inner, props } of P.lists.values()) if (isGridData(props.data) && inner.current) return { list: inner.current, props };
  return null;
}
let lastOffset = null;
let lastLines = null;
/** FlashList n'a pas d'onScroll à envelopper : sa position, à chaque image JS. */
function sampleFlash() {
  const inst = flashGrid();
  if (!inst) return;
  const offset = Math.round(inst.rlvRef.getCurrentScrollOffset());
  if (offset !== lastOffset) {
    lastOffset = offset;
    P.scroll.push([Date.now(), FLASH_LIST_ID, offset]);
  }
  const lines = inst.props.data.length;
  if (lines !== lastLines) {
    lastLines = lines;
    P.data.push([Date.now(), FLASH_LIST_ID, lines]);
  }
}

// ── La navigation : l'instant où la route change ───────────────────────────
let navWatched = false;
function watchNav() {
  if (navWatched) return;
  try {
    const { navigationRef } = require("../../../src/navigation/navigationRef");
    navigationRef.addListener("state", () => {
      const route = navigationRef.getCurrentRoute();
      if (P.armed && route) P.marks.push([Date.now(), `nav:${route.name}`]);
    });
    navWatched = true;
  } catch (e) {
    P.navError = String(e);
  }
}

// ── Commandes (par CDP) ─────────────────────────────────────────────────────
const uiMeter = createUiMeter((summary) => { P.ui = summary; });
let jsMeter = null;
P.arm = (label) => {
  Object.assign(P, { label: label || "", imgs: [], scroll: [], marks: [], data: [], ui: null, js: null, armedAt: Date.now(), armed: true });
  // L'état de départ : les affiches déjà montées (et chargées), les lignes déjà là.
  for (const [id, img] of P.live) {
    P.imgs.push([P.armedAt, "m", id, img.uri]);
    if (img.loaded) P.imgs.push([P.armedAt, "l", id, img.uri]);
  }
  for (const [id, { props }] of P.lists) P.data.push([P.armedAt, id, props.data ? props.data.length : 0]);
  lastOffset = null;
  lastLines = null;
  watchNav();
  jsMeter = startJsMeter(() => {
    try { sampleFlash(); } catch (e) { P.flashError = String(e); }
  });
  try { uiMeter.start(); } catch (e) { P.uiError = String(e); }
  return P.armedAt;
};
P.mark = (name) => { P.marks.push([Date.now(), name]); return true; };
P.disarm = () => {
  P.armed = false;
  if (jsMeter) P.js = jsMeter.stop();
  try { uiMeter.stop(); } catch (e) { P.uiError = String(e); }
  return Date.now();
};
/** La géométrie de la grille : [haut, hauteur, montée, 1re carte, cartes] par ligne,
 *  dans le repère du défilement (en-tête compris). */
P.grid = () => {
  const inst = flashGrid();
  if (inst) {
    // Les cellules de FlashList se repèrent après l'en-tête : `distanceFromWindow`.
    const head = inst.distanceFromWindow || 0;
    const rows = inst.props.data.map((line, i) => {
      const l = inst.rlvRef.getLayout(i);
      return [Math.round((l ? l.y : 0) + head), Math.round(l ? l.height : 0), 1, line.start, line.cards.length];
    });
    return { offset: Math.round(inst.rlvRef.getCurrentScrollOffset()), rows, flash: true };
  }
  const g = flatGrid();
  if (!g) return null;
  const vl = g.list._listRef;
  const rows = g.props.data.map((line, i) => {
    const m = vl._listMetrics.getCellMetricsApprox(i, vl.props);
    return [Math.round(m.offset), Math.round(m.length), m.isMounted ? 1 : 0, line.start, line.cards.length];
  });
  return { offset: Math.round(vl._scrollMetrics.offset), rows };
};
/** L'adresse de l'affiche de chaque carte, dans l'ordre de la grille. */
P.cards = () => {
  const inst = flashGrid();
  const data = inst ? inst.props.data : flatGrid()?.props.data;
  return data ? data.flatMap((line) => line.cards.map((card) => card.posterUri || null)) : null;
};
P.report = () => ({
  label: P.label, armedAt: P.armedAt, ui: P.ui, js: P.js, uiError: P.uiError,
  marks: P.marks, imgs: P.imgs, scroll: P.scroll, data: P.data, grid: P.grid(), cards: P.cards(),
});
/** Le rapport part au faux serveur (POST /__probe) : relu sans CDP. */
P.post = (url) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(P.report()) }).then((r) => r.status);
P.nav = (name, params) => {
  require("../../../src/navigation/railNavigate").railNavigate(name, params);
  return true;
};
P.reload = () => { RN.DevSettings.reload(); return true; };
// La trace image par image (position de la page, focus, télécommande).
require("./scrollTrace").installScrollTrace(P, flashGrid);

require("../../../src/utils/screenMetricsDiag");
