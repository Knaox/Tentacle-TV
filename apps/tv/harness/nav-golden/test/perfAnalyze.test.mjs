// Les verdicts du banc de fluidité (`perf/analyze.mjs`) sur des relevés FIGÉS :
// chaque seuil du « Validé fluidité » a son cas vert et son cas rouge,
// rejouables sans simulateur.
import assert from "node:assert/strict";
import test from "node:test";
import { THRESHOLDS, summarize, verdicts } from "../perf/analyze.mjs";

const T0 = 1_000_000;
const thread = (fps60, worst) => ({ fps60, dropped: 0, hitches: 0, long: worst ? [[T0, worst]] : [] });
const report = (extra = {}) => ({ armedAt: T0, watched: [], ui: thread(59.5, 40), js: thread(59, 50), focus: [], events: [], creates: [], createsTotal: 10, updates: 0, removes: 0, about: {}, ...extra });
const byName = (list, part) => list.find((v) => v.name.includes(part));

/** Une tenue sur une carte : focus à T0, puis les événements donnés (décalage, tag, type). */
function dwell(events, { trace = [], watched = [] } = {}) {
  const about = {
    1: { view: "RCTView", key: "grid:1", names: ["CardShell"] },
    10: { view: "RCTImageView", key: null, names: ["Image", "BackdropLayer"] },
    11: { view: "RCTImageView", key: null, names: ["Image", "TitleArt", "ZoneText"] },
    20: { view: "RCTVideo", key: null, names: ["Video", "PreviewVideo", "ZoneVideo"] },
    21: { view: "RCTVideo", key: null, names: [], gone: true },
  };
  const r = report({ focus: [[T0, 1]], events: events.map(([dt, tag, type]) => [T0 + dt, tag, type]), about, watched, ui: { ...thread(59.5, 40), trace } });
  return summarize("latence", { dwells: [{ label: "grille", keys: ["right"], endFocus: "grid:1", report: r }] });
}

/** Une vue suivie dont le cadre vaut `x` à chaque image donnée (décalage depuis le focus). */
const framesOf = (points) => points.map(([dt, x]) => [T0 + dt, x, 500, 300, 200]);

test("rafale : vert à 59,5 i/s sans écart long, rouge sous 57 i/s ou avec une image de plus de 100 ms", () => {
  const green = summarize("rafale-grille", { bursts: [{ label: "D×4", keys: 4, sentMs: 900, endFocus: "grid:4", report: report() }] });
  assert.ok(verdicts("rafale-grille", green).every((v) => v.ok));
  const slow = summarize("rafale-grille", { bursts: [{ label: "D×4", keys: 4, sentMs: 900, endFocus: "grid:4", report: report({ ui: thread(55.2, 40) }) }] });
  assert.equal(byName(verdicts("rafale-grille", slow), "i/s UI").ok, false);
  const hitch = summarize("rafale-grille", { bursts: [{ label: "D×4", keys: 4, sentMs: 900, endFocus: "grid:4", report: report({ ui: thread(59, 114) }) }] });
  const worst = byName(verdicts("rafale-grille", hitch), "pire image UI");
  assert.equal(worst.ok, false);
  assert.equal(worst.value, 114);
});

test("fond : la source posée sur le calque de fond compte, jamais le logo du titre ; au-delà de 200 ms, rouge", () => {
  const [green] = dwell([[30, 11, "setSource"], [45, 10, "setSource"], [90, 10, "topLoad"], [700, 20, "topReadyForDisplay"]]);
  assert.equal(green.fondSetMs, 45);
  assert.equal(green.fondMs, 90);
  assert.equal(byName(verdicts("latence", [green]), "fond posé").ok, true);
  const [late] = dwell([[30, 11, "setSource"], [260, 10, "setSource"], [700, 20, "topReadyForDisplay"]]);
  assert.equal(byName(verdicts("latence", [late]), "fond posé").ok, false);
  const [none] = dwell([[30, 11, "setSource"], [700, 20, "topReadyForDisplay"]]);
  assert.equal(none.fondSetMs, null);
  assert.equal(byName(verdicts("latence", [none]), "fond posé").ok, false);
});

test("vidéo : la 1re image d'un lecteur démonté ne compte pas ; au-delà de délai + 100 ms, rouge", () => {
  const [green] = dwell([[20, 10, "setSource"], [400, 21, "topReadyForDisplay"], [760, 20, "topReadyForDisplay"]]);
  assert.equal(green.videoMs, 760);
  assert.equal(byName(verdicts("latence", [green]), "1re image vidéo").ok, true);
  const [late] = dwell([[20, 10, "setSource"], [1100, 20, "topReadyForDisplay"]]);
  assert.equal(late.videoMs, 1100);
  assert.equal(byName(verdicts("latence", [late]), "1re image vidéo").ok, false);
  assert.equal(THRESHOLDS.videoMs, 900);
});

test("saut : une fin de défilement (< 2 pt par image) est verte, un déplacement d'un coup est rouge", () => {
  const watched = [{ tag: 1, key: "grid:1" }];
  const glide = framesOf([[0, 500], [100, 300], [684, 263], [700, 262], [716, 261], [732, 260], [900, 260]]);
  const [green] = dwell([[20, 10, "setSource"], [760, 20, "topReadyForDisplay"]], { trace: glide, watched });
  assert.equal(green.jumps.jumped, false);
  assert.equal(green.jumps.settledAtMs, 732);
  assert.equal(byName(verdicts("latence", [green]), "saut").ok, true);
  const jump = framesOf([[0, 500], [700, 500], [716, 500], [950, 500], [966, 32], [1200, 32]]);
  const [red] = dwell([[20, 10, "setSource"], [760, 20, "topReadyForDisplay"]], { trace: jump, watched });
  assert.equal(red.jumps.jumped, true);
  assert.equal(red.jumps.maxStepPt, 468);
  assert.equal(red.jumps.atMsAfterFocus, 966);
  assert.equal(byName(verdicts("latence", [red]), "saut").ok, false);
});

test("lecteur : un seul monté à la fois est vert, deux en même temps est rouge", () => {
  const one = [{ tag: 20 }];
  const raw = (steps) => ({ before: one, after: one, steps: steps.map((mounted, i) => ({ i, mounted })), report: report({ creates: [[T0, 20, "RCTVideo"]] }) });
  assert.equal(verdicts("lecteur", summarize("lecteur", raw([one, one, one])))[0].ok, true);
  const two = verdicts("lecteur", summarize("lecteur", raw([one, [{ tag: 20 }, { tag: 21 }], one])))[0];
  assert.equal(two.ok, false);
  assert.equal(two.value, 2);
});

test("mémoire : le tas JS jusqu'à +15 % de dev est vert, au-delà rouge, sans référence rouge", () => {
  const raw = (heapEnd) => ({
    minutes: 5, cycles: 18,
    samples: [
      { t: T0, phase: "début", rss: { pid: 1, rssKb: 400_000 }, heap: { heap: 60 * 1048576, gcs: 1 } },
      { t: T0 + 300_000, phase: "fin", rss: { pid: 1, rssKb: 350_000 }, heap: { heap: heapEnd * 1048576, gcs: 9 } },
    ],
  });
  const dev = summarize("memoire", raw(180));
  assert.equal(verdicts("memoire", summarize("memoire", raw(172)), dev)[0].ok, true);
  assert.equal(verdicts("memoire", summarize("memoire", raw(220)), dev)[0].ok, false);
  assert.equal(verdicts("memoire", summarize("memoire", raw(172)))[0].ok, false);
});

test("une pastille ou un raccourci focalisé n'attend ni fond ni vidéo", () => {
  const [pill] = summarize("latence", { dwells: [{ label: "accueil, filtre", keys: ["down"], endFocus: "filter:remove", report: report({ focus: [[T0, 1]] }) }] });
  assert.deepEqual(verdicts("latence", [pill]).filter((v) => !v.ok), []);
});
