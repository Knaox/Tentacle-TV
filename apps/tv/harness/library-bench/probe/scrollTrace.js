// La trace IMAGE PAR IMAGE du défilement de la grille — ce que l'œil voit :
// - sur le FIL D'INTERFACE, à chaque image (requestAnimationFrame du runtime
//   UI de Reanimated, battu par le CADisplayLink) : où est la page — la
//   position, dans l'écran, du contenu de la ScrollView de la grille
//   (`_measurePaper`, lu dans le modèle des vues : ce qui sera dessiné) —, et
//   où est l'élément focalisé ;
// - sur le fil JS : les événements de la télécommande et du focus
//   (`TVEventHandler` : `focus`, `blur`, flèches, glissers).
// Une chute de VITESSE sans image perdue (un défilement qui ralentit) ne se
// voit qu'ici : le compteur d'images (`frameMeter.js`) n'y verrait rien.
const RN = require("react-native");
const { makeMutable, runOnJS, runOnUI } = require("react-native-reanimated");

/** Le numéro natif du contenu de la ScrollView de la grille (FlashList). */
function contentTag(grid) {
  const scroll = grid && grid.rlvRef && grid.rlvRef._scrollComponent && grid.rlvRef._scrollComponent._scrollViewRef;
  return scroll && scroll.getInnerViewNode ? scroll.getInnerViewNode() : null;
}

function uiStart(tag, focusTag) {
  "worklet";
  const s = { active: true, frames: [] };
  global.__scrollTrace = s;
  const pageY = (t) => {
    if (!t) return null;
    const m = global._measurePaper(t);
    return m && m.x !== -1234567 ? Math.round(m.pageY * 10) / 10 : null;
  };
  const loop = (t) => {
    if (!s.active) return;
    // [horodatage de l'image, heure murale, haut du contenu, haut de l'élément focalisé]
    if (s.frames.length < 4000) s.frames.push([Math.round(t * 10) / 10, Date.now(), pageY(tag), pageY(focusTag.value)]);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/**
 * Greffe la trace sur la sonde (`P`) : armée et désarmée avec elle, rendue
 * dans son rapport (`trace`). `findGrid` rend l'instance FlashList de la grille.
 */
function installScrollTrace(P, findGrid) {
  const focusTag = makeMutable(0);
  let events = [];
  let frames = null;
  let subscription = null;
  const onResult = (result) => { frames = result; };
  function uiStop() {
    "worklet";
    const s = global.__scrollTrace;
    if (!s) return;
    s.active = false;
    runOnJS(onResult)(s.frames);
  }
  const { arm, disarm, report } = P;
  P.arm = (label) => {
    const at = arm(label);
    events = [];
    frames = null;
    const tag = contentTag(findGrid());
    if (RN.TVEventHandler && !subscription) {
      subscription = RN.TVEventHandler.addListener((e) => {
        if (!P.armed || !e) return;
        events.push([Date.now(), e.eventType, e.tag ?? null, e.eventKeyAction ?? null]);
        if (e.eventType === "focus" && e.tag) focusTag.value = e.tag;
      });
    }
    try { runOnUI(uiStart)(tag || 0, focusTag); } catch (err) { P.traceError = String(err); }
    P.traceTag = tag;
    return at;
  };
  P.disarm = () => {
    try { runOnUI(uiStop)(); } catch (err) { P.traceError = String(err); }
    return disarm();
  };
  P.report = () => ({ ...report(), trace: { tag: P.traceTag, error: P.traceError, events, frames } });
}

module.exports = { installScrollTrace };
