import assert from "node:assert/strict";
import { test } from "node:test";
import { configOverrides, LITE_AVDS, patchConfig, serialOf } from "../lib/lite/avd.mjs";
import { parseGfxinfo, parseMeminfo, parseProcMeminfo, perfettoConfig } from "../lib/lite/capture.mjs";
import { compareLite, delta, jankyOf } from "../lib/lite/liteReport.mjs";
import { TRIM_LEVELS } from "../lib/lite/pressure.mjs";
import { ENDURANCE_SEGMENTS, LITE_ROUTE } from "../lib/lite/route.mjs";
import { SCENARIOS } from "../lib/scenarios.mjs";
import { assertAllowed } from "../lib/keyGuard.mjs";

// Relevés réels, Lite_API31_2G (Android 12), app de mesure, le 07/10.
const GFX = `Total frames rendered: 263
Janky frames: 0 (0.00%)
Janky frames (legacy): 261 (99.24%)
50th percentile: 40ms
90th percentile: 250ms
95th percentile: 350ms
99th percentile: 950ms
Number Missed Vsync: 0
Number High input latency: 150
Number Slow UI thread: 0
Number Slow bitmap uploads: 0
Number Slow issue draw commands: 0
Number Frame deadline missed: 0
Number Frame deadline missed (legacy): 111`;

const MEM = ` App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:    21112                          48404
         Native Heap:   117660                         120464
                Code:    47980                         132428
               Stack:     1780                           1792
            Graphics:        0                              0
       Private Other:    45784
              System:     9187
             Unknown:                                   50732

           TOTAL PSS:   243503            TOTAL RSS:   353820      TOTAL SWAP (KB):        0
 Objects
               Views:     1867         ViewRootImpl:        1
         AppContexts:        5           Activities:        1`;

test("les AVD Lite : RAM et cœurs d'une box faible, consoles à part", () => {
  assert.deepEqual(Object.keys(LITE_AVDS), ["Lite_API31_1G", "Lite_API31_2G"]);
  assert.equal(serialOf("Lite_API31_2G"), "emulator-5642");
  assert.throws(() => serialOf("TentacleTV_TV"), /inconnu du banc Lite/);
  const overrides = configOverrides(LITE_AVDS.Lite_API31_1G);
  assert.equal(overrides["hw.ramSize"], "1024");
  assert.equal(overrides["hw.cpu.ncore"], "2");
  assert.equal(overrides["hw.gpu.mode"], "host");
});

test("config.ini : les clés données réécrites, les autres gardées, les absentes ajoutées", () => {
  const out = patchConfig("hw.ramSize=3072\nabi.type=arm64-v8a\n\n", { "hw.ramSize": "1024", "hw.cpu.ncore": "2" });
  assert.equal(out, "hw.ramSize=1024\nabi.type=arm64-v8a\nhw.cpu.ncore=2\n");
});

test("gfxinfo : les deux définitions des images ratées, et la part du fil UI", () => {
  const gfx = parseGfxinfo(GFX);
  assert.equal(gfx.frames, 263);
  assert.equal(gfx.janky, 0);
  assert.equal(gfx.jankyLegacy, 261);
  assert.equal(gfx.slowUiThread, 0);
  assert.equal(gfx.p90, 250);
  assert.equal(gfx.deadlineMissed, 0);
  assert.equal(gfx.deadlineMissedLegacy, 111);
  assert.equal(jankyOf(gfx), 261);
  assert.equal(jankyOf({ janky: 12 }), 12);
});

test("meminfo : le résumé de l'app en Mo, les vues", () => {
  const mem = parseMeminfo(MEM);
  assert.equal(mem.totalPss, 237.8);
  assert.equal(mem.javaHeap, 20.6);
  assert.equal(mem.nativeHeap, 114.9);
  assert.equal(mem.graphics, 0);
  assert.equal(mem.views, 1867);
  assert.equal(mem.activities, 1);
  assert.deepEqual(parseProcMeminfo("MemTotal:        2015580 kB\nMemAvailable:    1037936 kB\n"), { totalMb: 1968, availableMb: 1014, swapFreeMb: null });
});

test("Perfetto : l'app tracée, la mémoire et les morts du lowmemorykiller", () => {
  const config = perfettoConfig("com.tentacletv.mobile.perf", 60000);
  assert.match(config, /atrace_apps: "com.tentacletv.mobile.perf"/);
  assert.match(config, /lowmemorykiller\/lowmemory_kill/);
  assert.match(config, /duration_ms: 60000/);
});

test("le parcours ne joue que des scénarios connus, et des touches que la garde accepte", () => {
  for (const id of LITE_ROUTE) assert.ok(SCENARIOS.some((s) => s.id === id), id);
  for (const scenario of SCENARIOS) assertAllowed("com.tentacletv.mobile.perf", [...(scenario.setup ?? []), ...(scenario.gesture ?? [])]);
  for (const segment of ENDURANCE_SEGMENTS) assertAllowed("com.tentacletv.mobile.perf", segment.keys);
  assert.ok(TRIM_LEVELS.includes("RUNNING_CRITICAL"));
});

test("le tableau avant / après : écarts relatifs, et l'alerte de charge", () => {
  assert.equal(delta(100, 150), "100 → 150 (+50 %)");
  assert.equal(delta(null, null), "—");
  const run = (tag, pss, load) => ({
    tag, device: "émulateur", throttle: "none", maxHostLoad: load,
    cold: [{ launchMs: 1000, readyMs: 4000 }],
    memory: [{ app: { totalPss: pss, javaHeap: 20, nativeHeap: 100, graphics: 0 } }],
    endurance: [{ label: "tour 0", app: { totalPss: pss + 10 } }],
    screens: [{ id: "grille", cpu: { ui: 100, js: 50, render: 30 }, gfxFull: [{ frames: 100, jankyLegacy: 10, slowUiThread: 2, p90: 30 }], memory: [{ totalPss: pss, graphics: 0 }] }],
  });
  const table = compareLite(run("avant", 200, 12), run("apres", 150, 45));
  assert.match(table, /# avant → apres/);
  assert.match(table, /au-delà de 30/);
  assert.match(table, /\| grille \| 10,0 → 10,0 \(\+0 %\)/);
  assert.match(table, /Repos — totalPss \(Mo\) \| 200,0 → 150,0 \(-25 %\)/);
  assert.match(table, /Endurance, tour 0 — PSS \(Mo\) \| 210,0 → 160,0/);
});
