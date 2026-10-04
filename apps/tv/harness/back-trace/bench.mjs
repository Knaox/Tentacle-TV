#!/usr/bin/env node
/**
 * Le banc de traces du Retour (React sans DOM, sans simulateur).
 *
 *   node apps/tv/harness/back-trace/bench.mjs record   # enregistre au SHA de référence
 *   node apps/tv/harness/back-trace/bench.mjs verify   # rejoue sur l'arbre courant, compare
 *
 * `record` extrait l'arbre du SHA de référence (`git archive`, dans `out/`),
 * construit le banc (`harness.tsx`) pour iOS puis pour Android — la portée
 * d'origine, ses vraies dépendances, react-native et react-navigation en
 * doublures — et écrit `traces/<sha>.json`. `verify` construit le même banc
 * sur l'arbre courant et exige des traces IDENTIQUES, plateforme par
 * plateforme ; l'API nouvelle (`useBackLayers`) doit en plus redonner, sur
 * chaque scénario, la trace des couches inscrites une à une.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const REFERENCE = "84f3cedd0";
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: HERE, encoding: "utf8" }).trim();
const OUT = join(HERE, "out");
const TRACES = join(HERE, "traces");
const WEB_MODULES = join(REPO, "apps/web/node_modules");

/** L'arbre du SHA de référence, extrait une fois. */
function referenceTree() {
  const tree = join(OUT, `ref-${REFERENCE}`);
  if (existsSync(join(tree, "apps/tv/src"))) return tree;
  rmSync(tree, { recursive: true, force: true });
  mkdirSync(tree, { recursive: true });
  const archive = execFileSync("git", ["archive", REFERENCE, "apps/tv/src", "packages/tv-core/src", "packages/shared/src", "packages/theme/src"], {
    cwd: REPO,
    maxBuffer: 1 << 30,
  });
  execFileSync("tar", ["-x", "-C", tree], { input: archive });
  return tree;
}

/** Le banc Android REFONDU : l'aiguillage de la refonte forcé à vrai, comme sur un boîtier où elle est active. */
const REFONTE_GATE = {
  name: "refonte-gate",
  setup(context) {
    context.onResolve({ filter: /\/redesignGate$/ }, () => ({ path: "refonte-gate", namespace: "refonte" }));
    context.onLoad({ filter: /.*/, namespace: "refonte" }, () => ({
      contents: "export const REDESIGN_ACTIVE = true; export const REDESIGN_ROUTES = new Set();",
      loader: "ts",
    }));
  },
};

async function bundle(tree, os, refonte = false) {
  mkdirSync(OUT, { recursive: true });
  const outfile = join(OUT, `bench-${tree === REPO ? "courant" : "reference"}-${os}${refonte ? "-refonte" : ""}.mjs`);
  const first = os === "ios" ? [".ios.tsx", ".ios.ts"] : [".android.tsx", ".android.ts"];
  await build({
    entryPoints: [join(HERE, "harness.tsx")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    logLevel: "error",
    resolveExtensions: [...first, ".tsx", ".ts", ".mjs", ".js", ".json"],
    nodePaths: [join(REPO, "node_modules")],
    define: { __BENCH_OS__: JSON.stringify(os), __BENCH_REFONTE__: JSON.stringify(refonte) },
    plugins: refonte ? [REFONTE_GATE] : [],
    alias: {
      "@bench/BackScope": join(tree, "apps/tv/src/redesignWiring/back/BackScope.tsx"),
      "@tentacle-tv/tv-core": join(tree, "packages/tv-core/src/index.ts"),
      "@tentacle-tv/shared": join(tree, "packages/shared/src/index.ts"),
      "@tentacle-tv/theme": join(tree, "packages/theme/src/index.ts"),
      "react-native": join(HERE, "stubs/react-native.tsx"),
      "@react-navigation/native": join(HERE, "stubs/react-navigation.ts"),
      react: join(WEB_MODULES, "react"),
      "react-dom": join(WEB_MODULES, "react-dom"),
    },
    banner: { js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);" },
  });
  const output = execFileSync(process.execPath, [outfile], { encoding: "utf8", maxBuffer: 1 << 26 });
  return JSON.parse(output);
}

async function tracesOf(tree) {
  return { ios: await bundle(tree, "ios"), android: await bundle(tree, "android") };
}

/**
 * Android refondu = Apple TV : chaque appui des scénarios communs doit avoir
 * le MÊME effet que sur iOS (couche appelée, recul). Là où UIKit quitte
 * (l'appui laissé à la plateforme), Android appelle `exitApp`. Deux écarts
 * VOULUS, écrits ici : l'appui pris d'avance puis avalé (relevé B3) n'existe
 * pas sur Android, qui décide au relâchement — il quitte ; et l'écran qui
 * n'est pas devant laisse passer l'appui (scénario propre à Android).
 */
const ANDROID_EXPECTED = {
  "appui-avale": [{ to: "app", effects: ["exitApp"] }],
  "ecran-derriere": [{ to: "platform", effects: [] }],
};

function androidParity(ios, android) {
  const presses = (trace) => trace.filter((step) => "press" in step);
  const off = [];
  for (const [name, trace] of Object.entries(android.scenarios)) {
    const expected = ANDROID_EXPECTED[name] ??
      presses(ios.scenarios[name]).map((step) => (step.to === "platform" ? { to: "app", effects: ["exitApp"] } : { to: "app", effects: step.effects }));
    const obtained = presses(trace).map(({ to, effects }) => ({ to, effects }));
    if (JSON.stringify(expected) !== JSON.stringify(obtained)) off.push({ name, expected, obtained });
    if (trace.some((step) => step.interceptor)) off.push({ name, interceptor: "rendu sur Android" });
  }
  return off;
}

/** La part comparée : les scénarios et les appels aux API natives, pas ce qui n'existe que dans l'arbre courant. */
const comparable = (trace) => ({ scenarios: trace.scenarios, calls: trace.calls });

const command = process.argv[2];
if (command === "record") {
  const traces = await tracesOf(referenceTree());
  mkdirSync(TRACES, { recursive: true });
  const file = join(TRACES, `${REFERENCE}.json`);
  writeFileSync(file, `${JSON.stringify({ reference: REFERENCE, ios: comparable(traces.ios), android: comparable(traces.android) }, null, 2)}\n`);
  console.log(`traces enregistrées : ${resolve(file)}`);
} else if (command === "verify") {
  const recorded = JSON.parse(readFileSync(join(TRACES, `${REFERENCE}.json`), "utf8"));
  const current = await tracesOf(REPO);
  let failed = false;
  for (const os of ["ios", "android"]) {
    const same = JSON.stringify(comparable(current[os])) === JSON.stringify(recorded[os]);
    console.log(`${os} : ${same ? "identique à " + REFERENCE : "DIFFÉRENT de " + REFERENCE}`);
    if (!same) {
      failed = true;
      writeFileSync(join(OUT, `diff-${os}.json`), JSON.stringify({ attendu: recorded[os], obtenu: comparable(current[os]) }, null, 2));
    }
    const specs = current[os].specsEquivalent;
    if (specs) {
      const off = Object.entries(specs).filter(([, ok]) => !ok).map(([name]) => name);
      console.log(`${os} : useBackLayers ${off.length ? "DIFFÈRE sur " + off.join(", ") : "redonne chaque trace"}`);
      if (off.length) failed = true;
    }
  }
  const refonte = await bundle(REPO, "android", true);
  const off = androidParity(current.ios, refonte);
  console.log(`android refondu : ${off.length ? "DIFFÈRE d'iOS sur " + off.map((entry) => entry.name).join(", ") : "mêmes effets qu'iOS, appui par appui"}`);
  if (off.length) {
    failed = true;
    writeFileSync(join(OUT, "diff-android-refonte.json"), JSON.stringify(off, null, 2));
  }
  process.exit(failed ? 1 : 0);
} else {
  console.log("usage : node bench.mjs record | verify");
  process.exit(2);
}
