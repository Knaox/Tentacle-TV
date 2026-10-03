// L'enveloppe Metro du banc : la configuration de l'app DU CHECKOUT servi (le
// dossier courant ou la référence), plus trois choses, identiques pour l'un
// et l'autre :
//   1. les node_modules du dossier principal, que le checkout emprunte (liens) ;
//   2. la sonde (`probe/navProbe.js`), chargée avant `src/App` par le point
//      d'entrée — c'est le SEUL ajout au paquet, et il n'est pas dans l'app ;
//   3. un module tiers résolu dans un worktree pointe vers la copie du
//      principal : la référence et le code refactorisé tournent sur les mêmes
//      dépendances, octet pour octet.
// Paramètres par l'environnement : NAV_GOLDEN_CHECKOUT, NAV_GOLDEN_MAIN, NAV_GOLDEN_WATCH (JSON).
const fs = require("fs");
const path = require("path");

const checkout = process.env.NAV_GOLDEN_CHECKOUT;
const main = process.env.NAV_GOLDEN_MAIN;
const appDir = path.join(checkout, "apps/tv");
const entry = path.join(appDir, "index.js");
const probeDir = path.resolve(__dirname, "../probe");
const base = require(path.join(appDir, "metro.config.js"));
const baseResolve = base.resolver.resolveRequest;

/** Un fichier résolu dans un node_modules du checkout : la même copie chez le principal. */
function borrowed(filePath) {
  if (!main || path.resolve(checkout) === path.resolve(main)) return filePath;
  const rel = path.relative(checkout, filePath);
  if (rel.startsWith("..") || !rel.split(path.sep).includes("node_modules")) return filePath;
  const twin = path.join(main, rel);
  return fs.existsSync(twin) ? twin : filePath;
}

function resolveRequest(context, moduleName, platform) {
  const resolve = (ctx, name) => (baseResolve ? baseResolve(ctx, name, platform) : ctx.resolveRequest(ctx, name, platform));
  if (moduleName === "./src/App" && context.originModulePath === entry) {
    return { type: "sourceFile", filePath: path.join(probeDir, "appEntry.js") };
  }
  if (moduleName === "nav-golden-real-app") return resolve({ ...context, originModulePath: entry }, "./src/App");
  const result = resolve(context, moduleName);
  return result && result.type === "sourceFile" ? { ...result, filePath: borrowed(result.filePath) } : result;
}

const blockList = [].concat(base.resolver.blockList ?? [], [
  /\/apps\/tv\/ios\/(Pods|build|build-device)\/.*/,
  /\/apps\/tv\/android\/(build|app\/build|\.gradle)\/.*/,
]);

module.exports = {
  ...base,
  projectRoot: appDir,
  watchFolders: [...new Set([...(base.watchFolders ?? []), ...JSON.parse(process.env.NAV_GOLDEN_WATCH ?? "[]"), probeDir])],
  resolver: { ...base.resolver, blockList, resolveRequest },
};
