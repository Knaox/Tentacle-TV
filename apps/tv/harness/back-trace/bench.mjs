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

async function bundle(tree, os) {
  mkdirSync(OUT, { recursive: true });
  const outfile = join(OUT, `bench-${tree === REPO ? "courant" : "reference"}-${os}.mjs`);
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
    define: { __BENCH_OS__: JSON.stringify(os) },
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
  process.exit(failed ? 1 : 0);
} else {
  console.log("usage : node bench.mjs record | verify");
  process.exit(2);
}
