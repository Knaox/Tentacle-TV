const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// Packages qui DOIVENT se résoudre vers une copie physique UNIQUE.
//
// 1. Instances React : api-client et l'app TV sont tous deux en React 19,
//    mais deux COPIES physiques dans le bundle = deux instances = crash de
//    contexte. Le singleton vaut donc même à versions identiques.
// 2. Modules natifs avec ViewManagers : si deux copies JS du module finissent
//    dans le bundle, la vue native est enregistrée deux fois →
//    « Invariant Violation: Tried to register two views with the same name
//    RNCSafeAreaView » → crash AU LANCEMENT.
//    Le doublon vient des copies imbriquées sous @react-navigation/* et
//    react-native-css-interop (nativewind), exposées par le layout pnpm strict
//    en CI (absent en local dédupliqué — d'où un build local qui « marche »
//    alors que l'APK CI crashe).
const singletonNames = [
  "react",
  "react-native",
  "react-i18next",
  "i18next",
  "@tanstack/react-query",
  // Modules natifs (une seule instance JS) :
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-svg",
  "react-native-reanimated",
  "react-native-video",
  "react-native-linear-gradient",
  "react-native-webview",
  "react-native-css-interop",
  "@shopify/flash-list",
  "@react-native-async-storage/async-storage",
];
const singletonSet = new Set(singletonNames);

// extraNodeModules : map nom → dossier du package (copie unique), utile pour
// les résolutions qui ne passent pas par resolveRequest.
const extraNodeModules = {};
for (const name of singletonNames) {
  try {
    extraNodeModules[name] = path.dirname(
      require.resolve(`${name}/package.json`, { paths: [projectRoot] }),
    );
  } catch {
    // package absent du graphe → on ignore
  }
}

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, "node_modules"),
      path.resolve(monorepoRoot, "node_modules"),
    ],
    unstable_enableSymlinks: true,
    unstable_enablePackageExports: true,
    unstable_conditionNames: ["require", "react-native"],
    extraNodeModules,
    resolveRequest: (context, moduleName, platform) => {
      // Nom de package « nu » (gère les sous-chemins : react/jsx-runtime,
      // react-native/Libraries/..., react-native-safe-area-context/lib/...)
      const parts = moduleName.split("/");
      const pkgName = moduleName.startsWith("@")
        ? parts.slice(0, 2).join("/")
        : parts[0];

      if (singletonSet.has(pkgName)) {
        // Résout comme si l'import venait de la racine de l'app TV → copie
        // unique (et redirige react-native → react-native-tvos au passage).
        return context.resolveRequest(
          { ...context, originModulePath: path.join(projectRoot, "index.js") },
          moduleName,
          platform,
        );
      }

      // Fall back to default resolution
      return context.resolveRequest(context, moduleName, platform);
    },
  },
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
};

module.exports = mergeConfig(defaultConfig, config);
