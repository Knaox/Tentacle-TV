// Le compteur d'images de la sonde : sur le FIL D'INTERFACE (requestAnimationFrame
// du runtime UI de Reanimated, battu par le CADisplayLink) et sur le fil JS.
// Un intervalle de plus d'une image et demie est un accroc ; un intervalle de
// trois images en perd deux. `fps60` : les images/s ramenées à 60 Hz.
const { runOnJS, runOnUI } = require("react-native-reanimated");

const FRAME = 1000 / 60;

function newStats() {
  "worklet";
  return { active: true, first: 0, last: 0, frames: 0, dropped: 0, hitches: 0, hist: [0, 0, 0, 0, 0], long: [] };
}

function recordFrame(s, t) {
  "worklet";
  if (!s.first) s.first = t;
  if (s.last) {
    const dt = t - s.last;
    // Un rappel à moins de 4 ms : le double appel d'une image, pas une image.
    if (dt > 4) {
      s.frames += 1;
      const missed = dt > FRAME * 1.5 ? Math.round(dt / FRAME) - 1 : 0;
      if (missed > 0) {
        s.hitches += 1;
        s.dropped += missed;
        if (s.long.length < 400) s.long.push([Math.round(t - s.first), Math.round(dt)]);
      }
      s.hist[dt < 20 ? 0 : dt < 34 ? 1 : dt < 50 ? 2 : dt < 100 ? 3 : 4] += 1;
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
    hist: s.hist,
    long: s.long,
  };
}

function uiStart() {
  "worklet";
  const s = newStats();
  global.__libProbeUi = s;
  const loop = (t) => {
    if (!s.active) return;
    recordFrame(s, t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

/** Le compteur du fil d'interface : `stop` rend son bilan à `onResult` (fil JS). */
function createUiMeter(onResult) {
  function uiStop() {
    "worklet";
    const s = global.__libProbeUi;
    if (!s) return;
    s.active = false;
    runOnJS(onResult)(summarize(s));
  }
  return { start: () => runOnUI(uiStart)(), stop: () => runOnUI(uiStop)() };
}

/** Le compteur du fil JS ; `onFrame` est appelé à chaque image (échantillonnage). */
function startJsMeter(onFrame) {
  const s = newStats();
  const loop = (t) => {
    if (!s.active) return;
    recordFrame(s, t);
    if (onFrame) onFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return {
    stop: () => {
      s.active = false;
      return summarize(s);
    },
  };
}

module.exports = { createUiMeter, startJsMeter };
