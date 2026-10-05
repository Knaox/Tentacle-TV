// Le banc de traces du lecteur — voir README.md. Le code joué est celui du
// dossier `TRACE_WT` (par défaut ce dépôt ; la référence : `reference.sh`) ;
// les traces vivent dans CE dépôt (nav-golden/scenarios/lecteur/traces).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
const WT = process.env.TRACE_WT ?? REPO;
// L'ancien mode « android » (l'UI d'Android d'avant la bascule) n'existe plus.
if (process.env.TRACE_PLATFORM === "android") throw new Error("TRACE_PLATFORM=android est retiré avec l'ancienne UI d'Android TV : TRACE_PLATFORM=androidtv");
// Android TV refondu : les fichiers `.android` (l'entrée unique d'Android,
// `platform/input/index.android.ts`).
const androidtv = process.env.TRACE_PLATFORM === "androidtv";
const ext = [".ts", ".tsx", ".mjs", ".js", ".json"];
process.env.TRACE_GOLDEN ??= path.join(REPO, "apps/tv/harness/nav-golden/scenarios/lecteur/traces");

export default defineConfig({
  root: HERE,
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.join(HERE, "mocks/react-native.ts") },
      { find: /^@react-navigation\/native$/, replacement: path.join(HERE, "mocks/navigation.ts") },
      { find: /^(\.\.\/)+back\/BackScope$/, replacement: path.join(HERE, "mocks/BackScope.ts") },
      { find: /^@tv\//, replacement: `${WT}/apps/tv/src/` },
      { find: /^@tentacle-tv\/tv-core$/, replacement: `${WT}/packages/tv-core/src/index.ts` },
      { find: /^@tentacle-tv\/shared$/, replacement: `${WT}/packages/shared/src/index.ts` },
      { find: /^react$/, replacement: `${WT}/node_modules/react` },
      { find: /^react\/(.*)$/, replacement: `${WT}/node_modules/react/$1` },
      { find: /^react-dom\/client$/, replacement: `${WT}/node_modules/react-dom/client.js` },
    ],
    extensions: androidtv ? [".android.ts", ".android.tsx", ...ext] : [".ios.ts", ".ios.tsx", ...ext],
  },
  define: { __DEV__: "false" },
  server: { fs: { allow: [HERE, WT, REPO] } },
  test: {
    include: ["trace.test.ts", "androidtv.test.ts", "skipPill.test.ts"],
    setupFiles: ["./setup.ts"],
    environment: "node",
    testTimeout: 120_000,
    pool: "forks",
  },
});
