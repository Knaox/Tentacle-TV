const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// Singleton packages — all imports must resolve to the SAME physical copy
// to avoid duplicate React instances (api-client has React 19, TV app has React 18).
const singletonPkgs = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
  "react-i18next": path.resolve(projectRoot, "node_modules/react-i18next"),
  i18next: path.resolve(projectRoot, "node_modules/i18next"),
  "@tanstack/react-query": path.resolve(projectRoot, "node_modules/@tanstack/react-query"),
};

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
    unstable_conditionNames: ["require", "import", "react-native"],
    extraNodeModules: singletonPkgs,
    resolveRequest: (context, moduleName, platform) => {
      // Redirect singleton packages to the TV app's copy
      if (singletonPkgs[moduleName]) {
        return {
          filePath: require.resolve(moduleName, {
            paths: [projectRoot],
          }),
          type: "sourceFile",
        };
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
