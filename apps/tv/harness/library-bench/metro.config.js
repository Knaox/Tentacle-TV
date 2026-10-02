// L'enveloppe Metro du banc des bibliothèques :
//   react-native start --port <p> --config harness/library-bench/metro.config.js
// La config de l'app TV, plus :
// - la SONDE (`probe/libProbe.js`) à la place de `src/utils/screenMetricsDiag`,
//   qu'index.js importe et qu'elle réimporte : rien à changer dans l'app ;
// - un cache à soi (`BENCH_METRO_CACHE`, sinon un dossier temporaire) : un
//   `--reset-cache` ne vide pas celui des autres sessions ;
// - ni les Pods ni les builds natifs dans la carte des fichiers (sans quoi le
//   premier paquet dépasse le délai de l'app, dans un worktree).
// `LIB_PROBE=0` : l'app telle quelle, sans sonde.
const os = require("os");
const path = require("path");

const APP = path.resolve(__dirname, "../..");
const REPO = path.resolve(APP, "../..");
const base = require(path.join(APP, "metro.config.js"));
const metroConfigDir = path.dirname(require.resolve("@react-native/metro-config/package.json", { paths: [APP] }));
const { FileStore } = require(require.resolve("metro-cache", { paths: [metroConfigDir] }));

const PROBE = process.env.LIB_PROBE === "0" ? null : path.join(__dirname, "probe/libProbe.js");
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const blockList = [
  "apps/tv/ios/Pods", "apps/tv/ios/build", "apps/tv/android", "apps/mobile/ios", "apps/mobile/android",
  "apps/desktop-electron", "apps/tv/harness/ui-bench/out", "apps/tv/harness/ui-bench/snapshot",
  "apps/tv/harness/library-bench/img", "apps/tv/harness/library-bench/bundles", "apps/tv/harness/library-bench/out",
].map((dir) => new RegExp(`^${escape(path.join(REPO, dir))}/.*`));
const resolveBase = base.resolver.resolveRequest;

module.exports = {
  ...base,
  projectRoot: APP,
  cacheStores: [new FileStore({ root: process.env.BENCH_METRO_CACHE ?? path.join(os.tmpdir(), "tentacle-library-bench-metro") })],
  resolver: {
    ...base.resolver,
    blockList,
    resolveRequest: (context, moduleName, platform) => {
      if (PROBE && moduleName === "./src/utils/screenMetricsDiag" && context.originModulePath === path.join(APP, "index.js")) {
        return { type: "sourceFile", filePath: PROBE };
      }
      return resolveBase(context, moduleName, platform);
    },
  },
};
