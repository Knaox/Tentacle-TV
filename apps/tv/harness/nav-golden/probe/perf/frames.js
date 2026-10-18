/* eslint-disable */
// Les COMPTEURS D'IMAGES de la sonde de fluidité (`../perfProbe.js`) : fil
// d'interface (requestAnimationFrame du runtime UI de Reanimated, battu par le
// CADisplayLink), avec en mode « trace » le cadre des vues suivies à chaque
// image, et fil JS. Un intervalle de plus d'une image et demie est un accroc.
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

module.exports = {
  watchTags,
  traceOn,
  startUi: () => runOnUI(uiStart)(),
  stopUi: () => runOnUI(uiStop)(),
  uiReport: () => uiResult,
  resetUi: () => {
    uiResult = null;
  },
  jsStart,
  jsStop,
};
