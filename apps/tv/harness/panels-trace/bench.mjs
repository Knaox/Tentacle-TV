#!/usr/bin/env node
/**
 * Le banc de traces des panneaux et des cartes (React sans DOM, sans
 * simulateur) — la preuve que le branchement de T6 ne change rien.
 *
 *   node apps/tv/harness/panels-trace/bench.mjs record   # au SHA de référence → traces/<sha>.json
 *   node apps/tv/harness/panels-trace/bench.mjs verify   # l'arbre courant : traces IDENTIQUES exigées
 *
 * Les mêmes scénarios (`harness.tsx`, `units/`) montent les vrais modules de
 * chaque arbre — le verrou d'entrée, le focus du grand panneau, la garde
 * anti-clic fantôme, les pictos, l'échelle, le double appui, les actions
 * d'une carte, le cycle du grand panneau, la feuille des saisons — sur des
 * doublures (`stubs/`) : react-native, reanimated, i18n, navigation,
 * api-client, et quelques vues qui ne font que dessiner.
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
const STUBS = join(HERE, "stubs");

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

/** Ce qui, dans l'arbre, ne fait que dessiner — remplacé par une doublure qui note ses props. */
const VIEW_STUBS = [
  [/redesign\/screens\/sheet\/RulerCell$/, "views.tsx"],
  [/redesign\/rating\/RatingStars$/, "views.tsx"],
  [/redesign\/screens\/settings\/ConfirmPill$/, "views.tsx"],
  [/redesign\/controls\/PillButton$/, "views.tsx"],
  [/redesign\/brand\/BrandMark$/, "views.tsx"],
  [/redesign\/glass\/GlassSurface$/, "views.tsx"],
  [/redesign\/glass\/glassBacking$/, "views.tsx"],
  [/redesign\/screens\/sheet\/ActionSheetView$/, "views.tsx"],
  [/redesign\/screens\/requests\/SeasonsSheet$/, "views.tsx"],
  [/redesign\/motion\/FadingModal$/, "views.tsx"],
  [/redesignWiring\/sheet\/useSheetModel$/, "sheetModel.ts"],
  [/redesignWiring\/vigie\/liveRequests$/, "vigie.ts"],
  [/redesignWiring\/vigie\/useAppActive$/, "vigie.ts"],
];

/** `@bench/src/…` : le dossier `apps/tv/src` de l'arbre ; `@bench/sheetFocus` : l'applicateur du panneau, où qu'il vive. */
function treePlugin(tree) {
  const src = join(tree, "apps/tv/src");
  const sheetFocus = ["platform/tvos/panels/sheetFocus.ts", "redesignWiring/sheet/sheetFocus.ts"].map((p) => join(src, p)).find(existsSync);
  return {
    name: "bench-tree",
    setup(b) {
      b.onResolve({ filter: /^@bench\/sheetFocus$/ }, () => ({ path: sheetFocus }));
      // Les paquets du dépôt, pris dans l'arbre construit (et leurs sous-chemins : `@tentacle-tv/shared/theme`).
      b.onResolve({ filter: /^@tentacle-tv\/(shared|theme|tv-core)(\/.*)?$/ }, (args) => {
        const [, pkg, sub = ""] = /^@tentacle-tv\/([^/]+)(\/.*)?$/.exec(args.path);
        const base = join(tree, "packages", pkg, "src", sub.slice(1));
        const found = [join(base, "index.ts"), `${base}.ts`, join(base, "preset.ts")].find(existsSync);
        return found ? { path: found } : undefined;
      });
      b.onResolve({ filter: /^@bench\/src\// }, async (args) => b.resolve(`./${args.path.slice("@bench/src/".length)}`, { resolveDir: src, kind: args.kind }));
      b.onResolve({ filter: /^\.\.?\// }, (args) => {
        if (!args.importer.startsWith(src)) return undefined;
        const target = join(args.resolveDir, args.path);
        const hit = VIEW_STUBS.find(([pattern]) => pattern.test(target));
        return hit ? { path: join(STUBS, hit[1]) } : undefined;
      });
    },
  };
}

async function tracesOf(tree) {
  mkdirSync(OUT, { recursive: true });
  const outfile = join(OUT, `bench-${tree === REPO ? "courant" : "reference"}.mjs`);
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
    define: { __BENCH_OS__: JSON.stringify("ios"), __DEV__: "false" },
    plugins: [treePlugin(tree)],
    alias: {
      "@tentacle-tv/api-client": join(STUBS, "api-client.ts"),
      "react-native": join(STUBS, "react-native.tsx"),
      "react-native-reanimated": join(STUBS, "reanimated.tsx"),
      "react-native-svg": join(STUBS, "svg.tsx"),
      "react-i18next": join(STUBS, "i18n.ts"),
      "@react-navigation/native": join(STUBS, "navigation.ts"),
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
  const traces = await tracesOf(referenceTree());
  mkdirSync(TRACES, { recursive: true });
  const file = join(TRACES, `${REFERENCE}.json`);
  writeFileSync(file, `${JSON.stringify({ reference: REFERENCE, ...traces }, null, 1)}\n`);
  console.log(`traces enregistrées : ${resolve(file)} — ${Object.keys(traces.units).length} unités`);
} else if (command === "verify") {
  const recorded = JSON.parse(readFileSync(join(TRACES, `${REFERENCE}.json`), "utf8"));
  const current = await tracesOf(REPO);
  let failed = false;
  for (const [unit, trace] of Object.entries(recorded.units)) {
    const same = JSON.stringify(current.units[unit]) === JSON.stringify(trace);
    console.log(`${unit} : ${same ? "identique à " + REFERENCE : "DIFFÉRENT de " + REFERENCE}`);
    if (!same) {
      failed = true;
      writeFileSync(join(OUT, `diff-${unit}.json`), JSON.stringify({ attendu: trace, obtenu: current.units[unit] }, null, 1));
    }
  }
  process.exit(failed ? 1 : 0);
} else {
  console.log("usage : node bench.mjs record | verify");
  process.exit(2);
}
