const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

// BOTH paths needed: local for @tentacle-tv/* symlinks, root for hoisted deps
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Map all root-hoisted packages so Metro finds them even when
// they are missing from apps/mobile/node_modules/ (pnpm hoisting).
const rootModules = path.resolve(monorepoRoot, "node_modules");
const extraNodeModules = {};
for (const entry of fs.readdirSync(rootModules)) {
  if (entry.startsWith(".")) continue;
  if (entry.startsWith("@")) {
    // Scoped packages
    const scopeDir = path.join(rootModules, entry);
    for (const pkg of fs.readdirSync(scopeDir)) {
      extraNodeModules[`${entry}/${pkg}`] = path.join(scopeDir, pkg);
    }
  } else {
    extraNodeModules[entry] = path.join(rootModules, entry);
  }
}
config.resolver.extraNodeModules = extraNodeModules;

// Force singleton packages to resolve from the mobile app's perspective,
// NOT from workspace packages like api-client which have react@19 locally.
// Without this, two React instances end up in the bundle → context crashes.
const singletonPkgs = new Set([
  "react",
  "react-dom",
  "react-native",
]);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Extract bare package name (handles sub-paths like react/jsx-runtime)
  const parts = moduleName.split("/");
  const pkgName = moduleName.startsWith("@")
    ? parts.slice(0, 2).join("/")
    : parts[0];

  if (singletonPkgs.has(pkgName)) {
    // Resolve from the mobile project root instead of the importing file's location
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, "index.js") },
      moduleName,
      platform,
    );
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
