#!/usr/bin/env node
/**
 * Le banc de traces du focus (React sans DOM, sans simulateur).
 *
 *   node apps/tv/harness/focus-trace/bench.mjs record   # enregistre au SHA de référence
 *   node apps/tv/harness/focus-trace/bench.mjs verify   # rejoue sur l'arbre courant, compare
 *
 * `record` extrait l'arbre du SHA de référence (`git archive`, dans `out/`),
 * construit le banc (`harness.tsx`) — les applicateurs d'origine, leurs vraies
 * dépendances (tv-core, theme, shared de la référence), react-native et
 * react-navigation en doublures — et écrit `traces/<sha>.json`. `verify`
 * construit le même banc sur l'arbre courant et exige des traces IDENTIQUES.
 *
 * Ce qui diffère entre les deux arbres, et seulement cela, est aiguillé ici :
 * le chemin de « au-delà du bord » (déplacé), la direction (« right » →
 * « droite », le vocabulaire de tv-core), la source de Menu (rien → l'entrée
 * unique), et l'écriture des entrées de la fiche (la règle d'origine → la
 * primitive `useFirstVisitEntry`).
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

/** Ce que chaque arbre branche à sa façon. */
function variantOf(tree, reference) {
  const src = join(tree, "apps/tv/src");
  return reference
    ? {
        "@bench/beyondEdge": join(src, "redesignWiring/remote/useBeyondEdge.ts"),
        "@bench/detailEntries": join(HERE, "adapters/detailEntriesReference.ts"),
        "@bench/detailGuides": join(src, "redesignWiring/detail/useDetailGuides.ts"),
        "@bench/menu": join(HERE, "adapters/noInput.ts"),
      }
    : {
        "@bench/beyondEdge": join(src, "platform/tvos/focus/useBeyondEdge.ts"),
        "@bench/detailEntries": join(HERE, "adapters/detailEntriesCurrent.ts"),
        "@bench/sectionEntry": join(src, "platform/tvos/focus/sectionEntry.ts"),
        "@bench/menu": join(HERE, "adapters/inputCurrent.ts"),
        "@bench/input": join(src, "platform/tvos/input/index.ts"),
      };
}

/** Le rail (T4) n'est pas sous l'épreuve : sa convention de clés, en doublure. */
const railStub = {
  name: "rail-stub",
  setup(builder) {
    builder.onResolve({ filter: /\/useRailState$/ }, () => ({ path: join(HERE, "stubs/others.ts") }));
  },
};

async function bundle(tree) {
  mkdirSync(OUT, { recursive: true });
  const reference = tree !== REPO;
  const outfile = join(OUT, `bench-${reference ? "reference" : "courant"}.mjs`);
  const src = join(tree, "apps/tv/src");
  await build({
    entryPoints: [join(HERE, "harness.tsx")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    jsx: "automatic",
    logLevel: "error",
    resolveExtensions: [".ios.tsx", ".ios.ts", ".tsx", ".ts", ".mjs", ".js", ".json"],
    nodePaths: [join(REPO, "node_modules")],
    define: { __BENCH_RIGHT__: JSON.stringify(reference ? "right" : "droite") },
    plugins: [railStub],
    alias: {
      "@bench/focusStore": join(src, "redesignWiring/focus/focusStore.ts"),
      "@bench/claimAfterRestore": join(src, "redesignWiring/focus/claimAfterRestore.ts"),
      "@bench/entryGuide": join(src, "redesignWiring/focus/entryGuide.tsx"),
      "@bench/keepFocusWithin": join(src, "redesignWiring/focus/useKeepFocusWithin.ts"),
      "@bench/entryFocus": join(src, "redesignWiring/screen/useEntryFocus.ts"),
      "@bench/heroRotation": join(src, "redesignWiring/home/useHeroRotation.ts"),
      ...variantOf(tree, reference),
      "@tentacle-tv/tv-core": join(tree, "packages/tv-core/src"),
      "@tentacle-tv/shared": join(tree, "packages/shared/src"),
      "@tentacle-tv/theme": join(tree, "packages/theme/src"),
      "react-native": join(HERE, "stubs/react-native.tsx"),
      "@react-navigation/native": join(HERE, "stubs/others.ts"),
      "react-native-reanimated": join(HERE, "stubs/others.ts"),
      react: join(WEB_MODULES, "react"),
      "react-dom": join(WEB_MODULES, "react-dom"),
    },
    banner: { js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);" },
  });
  const output = execFileSync(process.execPath, [outfile], { encoding: "utf8", maxBuffer: 1 << 26 });
  return JSON.parse(output);
}

const command = process.argv[2];
if (command === "record") {
  const traces = await bundle(referenceTree());
  mkdirSync(TRACES, { recursive: true });
  const file = join(TRACES, `${REFERENCE}.json`);
  writeFileSync(file, `${JSON.stringify({ reference: REFERENCE, ...traces }, null, 2)}\n`);
  const errors = Object.entries(traces.scenarios).filter(([, trace]) => trace?.error).map(([name]) => name);
  console.log(`traces enregistrées : ${resolve(file)}${errors.length ? ` — EN ERREUR : ${errors.join(", ")}` : ""}`);
  process.exit(errors.length ? 1 : 0);
} else if (command === "verify") {
  const recorded = JSON.parse(readFileSync(join(TRACES, `${REFERENCE}.json`), "utf8"));
  const current = await bundle(REPO);
  let failed = false;
  for (const [name, trace] of Object.entries(recorded.scenarios)) {
    const same = JSON.stringify(current.scenarios[name]) === JSON.stringify(trace);
    console.log(`${same ? "✓" : "✗"} ${name}`);
    if (!same) {
      failed = true;
      writeFileSync(join(OUT, `diff-${name}.json`), JSON.stringify({ attendu: trace, obtenu: current.scenarios[name] }, null, 2));
    }
  }
  console.log(failed ? `DIFFÉRENT de ${REFERENCE} (détail : out/diff-*.json)` : `identique à ${REFERENCE}`);
  process.exit(failed ? 1 : 0);
} else {
  console.log("usage : node bench.mjs record | verify");
  process.exit(2);
}
