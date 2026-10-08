#!/usr/bin/env node
// Compare, paquet par paquet, les dépendances INSTALLÉES d'un `node_modules`
// au verrou du dépôt (pnpm-lock.yaml, format 9).
//
// Usage : check-lockfile-deps.mjs [--drop-optional-peers] <pnpm-lock.yaml> <importer> <node_modules>
//   ex. : check-lockfile-deps.mjs pnpm-lock.yaml apps/backend /deploy/node_modules
//
// Le Dockerfile (étape « prod-deps ») le lance juste après `pnpm deploy`, AVANT
// l'élagage : l'image ne se construit pas si ses dépendances de production
// s'écartent du verrou. Relevé du 2026-10-08 : un `deploy --legacy` résolvait
// tout à neuf depuis le registre — fastify 5.12.5 au lieu de 5.7.4, et undici
// 7 au lieu du 6 que demande le serveur.
//
// Cinq écarts, tous fatals :
//   • périmé   — le `package.json` de l'importeur ne dit plus ce que dit le
//                verrou (`pnpm deploy` installerait le verrou SANS le dire) ;
//   • version  — une dépendance directe n'a pas la version du verrou ;
//   • inconnu  — un paquet installé à une version que le verrou ne connaît pas ;
//   • en trop  — un paquet hors de la fermeture de production de l'importeur ;
//   • manquant — un paquet requis (ni facultatif, ni pair facultatif) absent.
//
// `--drop-optional-peers` retire d'abord ce que seuls des PAIRS FACULTATIFS
// atteignent : la CLI prisma et typescript, que @prisma/client accepte sans
// les exiger, et leur sous-arbre. Le verrou les porte (autoInstallPeers), mais
// le serveur ne les charge jamais. Les dépendances facultatives ordinaires
// (binaires d'une plateforme) restent.
//
// Sans dépendance : il tourne avec le seul Node de l'image. Le verrou se lit
// par un analyseur réduit au format qu'écrit pnpm 10 (indentation fixe).
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const unquote = (s) => s.replace(/^'(.*)'$/, "$1");
const emptyDeps = () => ({ dependencies: {}, optionalDependencies: {} });

/** « nom@1.2.3(pair@4.5.6) » → { name, version } (sans le suffixe des pairs). */
export function parseKey(key) {
  const bare = key.replace(/\(.*$/, "");
  const at = bare.lastIndexOf("@");
  return { name: bare.slice(0, at), version: bare.slice(at + 1) };
}

/** Clé de snapshot visée par une entrée de dépendance (alias `npm:` compris). */
export function depTarget(name, ref) {
  if (ref.startsWith("link:") || ref.startsWith("file:")) return null;
  // Alias : `string-width-cjs: string-width@4.2.3`.
  if (/^(@[^@/]+\/)?[^@()]+@/.test(ref)) return ref;
  return `${name}@${ref}`;
}

/**
 * Lit les trois sections utiles du verrou : importers (versions ET
 * spécificateurs), packages (avec leurs pairs), snapshots.
 * Clés à 2 espaces, champs à 4, entrées à 6 (et 8 sous une dépendance d'importeur).
 */
export function parseLockfile(text) {
  const importers = {};
  const specifiers = {};
  const packages = new Map();
  const snapshots = {};
  let section = null;
  let key = null;
  let field = null;
  let dep = null;
  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();
    if (indent === 0) {
      section = line.replace(/:.*$/, "");
      continue;
    }
    if (indent === 2) {
      key = unquote(line.replace(/:( \{\})?$/, ""));
      field = null;
      if (section === "importers") {
        importers[key] = emptyDeps();
        specifiers[key] = emptyDeps();
      }
      if (section === "packages") packages.set(key, { peers: new Set() });
      if (section === "snapshots") snapshots[key] = emptyDeps();
      continue;
    }
    if (indent === 4) {
      field = line.replace(/:.*$/, "");
      continue;
    }
    const name = () => unquote(line.slice(0, line.indexOf(":")));
    if (section === "packages" && field === "peerDependencies" && indent === 6) {
      packages.get(key).peers.add(name());
    }
    if (!(field === "dependencies" || field === "optionalDependencies")) continue;
    if (section === "snapshots" && indent === 6) {
      snapshots[key][field][name()] = unquote(line.slice(line.indexOf(": ") + 2));
    } else if (section === "importers" && indent === 6) {
      dep = name();
    } else if (section === "importers" && indent === 8) {
      const [prop, ...rest] = line.split(": ");
      const value = unquote(rest.join(": "));
      if (prop === "version") importers[key][field][dep] = value;
      if (prop === "specifier") specifiers[key][field][dep] = value;
    }
  }
  return { importers, specifiers, packages, snapshots };
}

/**
 * Fermeture de production d'un importeur, en « nom@version » :
 *   • `required` — ce qui doit être là (arêtes ordinaires depuis la racine) ;
 *   • `allowed`  — ce qui peut l'être, facultatifs ordinaires compris ;
 *   • `optionalPeers` — ce que SEULS des pairs facultatifs atteignent.
 */
export function productionClosure(lock, importer) {
  const root = lock.importers[importer];
  if (!root) throw new Error(`importeur « ${importer} » absent du verrou`);

  const walk = (followOptionalPeers) => {
    const required = new Set();
    const allowed = new Set();
    const seen = new Set();
    const queue = [];
    const push = (name, ref, optional) => {
      const target = depTarget(name, ref);
      if (target) queue.push({ key: target, optional });
    };
    for (const [n, v] of Object.entries(root.dependencies)) push(n, v, false);
    for (const [n, v] of Object.entries(root.optionalDependencies)) push(n, v, true);
    while (queue.length) {
      const { key, optional } = queue.shift();
      if (seen.has(`${key}|${optional}`)) continue;
      seen.add(`${key}|${optional}`);
      const { name, version } = parseKey(key);
      const id = `${name}@${version}`;
      allowed.add(id);
      if (!optional) required.add(id);
      const snap = lock.snapshots[key] ?? emptyDeps();
      const peers = lock.packages.get(id)?.peers ?? new Set();
      for (const [n, v] of Object.entries(snap.dependencies)) push(n, v, optional);
      for (const [n, v] of Object.entries(snap.optionalDependencies)) {
        if (followOptionalPeers || !peers.has(n)) push(n, v, true);
      }
    }
    return { required, allowed };
  };

  const strict = walk(false);
  const full = walk(true);
  const optionalPeers = new Set([...full.allowed].filter((id) => !strict.allowed.has(id)));
  return { required: strict.required, allowed: strict.allowed, optionalPeers };
}

/** Tous les paquets d'un node_modules, imbrications comprises : [{ dir, name, version }]. */
export function installedPackages(nodeModules) {
  const found = [];
  const visit = (nm) => {
    if (!existsSync(nm)) return;
    for (const entry of readdirSync(nm)) {
      // `.bin`, `.pnpm`, `.modules.yaml`, et `.prisma` (client généré, hors verrou).
      if (entry.startsWith(".")) continue;
      const full = join(nm, entry);
      if (!statSync(full).isDirectory()) continue;
      const dirs = entry.startsWith("@") ? readdirSync(full).map((s) => join(full, s)) : [full];
      for (const dir of dirs) {
        const manifest = join(dir, "package.json");
        if (!existsSync(manifest)) continue;
        const { name, version } = JSON.parse(readFileSync(manifest, "utf8"));
        found.push({ dir, name, version });
        visit(join(dir, "node_modules"));
      }
    }
  };
  visit(nodeModules);
  return found;
}

/** Ce que le `package.json` déclare et que le verrou ne dit plus (ou plus pareil). */
export function staleSpecifiers(lock, importer, manifest) {
  const problems = [];
  for (const field of ["dependencies", "optionalDependencies"]) {
    const declared = manifest[field] ?? {};
    const locked = lock.specifiers[importer]?.[field] ?? {};
    for (const name of new Set([...Object.keys(declared), ...Object.keys(locked)])) {
      if (declared[name] !== locked[name]) {
        problems.push({
          kind: "périmé",
          id: `${field}.${name} : package.json ${declared[name] ?? "—"}, verrou ${locked[name] ?? "—"}`,
        });
      }
    }
  }
  return problems;
}

/** Retire les paquets que seuls des pairs facultatifs atteignent ; rend leurs dossiers. */
export function dropOptionalPeers(lock, importer, nodeModules) {
  const { optionalPeers } = productionClosure(lock, importer);
  const dropped = installedPackages(nodeModules).filter((p) => optionalPeers.has(`${p.name}@${p.version}`));
  for (const { dir } of dropped) rmSync(dir, { recursive: true, force: true });
  return dropped;
}

/** Les écarts entre ce qui est installé et le verrou ; vide = conforme. */
export function compare(lock, importer, nodeModules) {
  const { required, allowed } = productionClosure(lock, importer);
  const installed = installedPackages(nodeModules);
  const problems = [];
  const present = new Set();
  for (const { dir, name, version } of installed) {
    const id = `${name}@${version}`;
    present.add(id);
    if (!lock.packages.has(id)) problems.push({ kind: "inconnu", id, dir });
    else if (!allowed.has(id)) problems.push({ kind: "en trop", id, dir });
  }
  for (const [name, ref] of Object.entries(lock.importers[importer].dependencies)) {
    const target = depTarget(name, ref);
    if (!target) continue;
    const want = parseKey(target).version;
    const top = installed.find((p) => p.dir === join(nodeModules, name));
    if (top && top.version !== want) {
      problems.push({ kind: "version", id: `${name} ${top.version} ≠ ${want}`, dir: top.dir });
    }
  }
  for (const id of required) if (!present.has(id)) problems.push({ kind: "manquant", id });
  return { problems, installed: installed.length, required: required.size };
}

function main(argv) {
  const drop = argv[0] === "--drop-optional-peers";
  const [lockPath, importer, nodeModules] = drop ? argv.slice(1) : argv;
  if (!lockPath || !importer || !nodeModules) {
    console.error("usage : check-lockfile-deps.mjs [--drop-optional-peers] <pnpm-lock.yaml> <importer> <node_modules>");
    process.exit(2);
  }
  const lock = parseLockfile(readFileSync(lockPath, "utf8"));
  const manifestPath = join(dirname(lockPath), importer, "package.json");
  const stale = staleSpecifiers(lock, importer, JSON.parse(readFileSync(manifestPath, "utf8")));
  if (drop) {
    const dropped = dropOptionalPeers(lock, importer, nodeModules);
    console.log(`[deps] ${dropped.length} pair(s) facultatif(s) retiré(s) : ${dropped.map((p) => p.name).join(" ") || "aucun"}`);
  }
  const { problems, installed, required } = compare(lock, importer, nodeModules);
  problems.unshift(...stale);
  if (problems.length === 0) {
    console.log(`[deps] ${installed} paquets installés, tous au verrou (${required} requis).`);
    return;
  }
  console.error(`[deps] ${problems.length} écart(s) entre ${nodeModules} et ${lockPath} :`);
  for (const p of problems) console.error(`  ${p.kind.padEnd(8)} ${p.id}${p.dir ? `  (${p.dir})` : ""}`);
  if (stale.length) console.error("[deps] Verrou périmé : lancer `pnpm install` et commiter pnpm-lock.yaml.");
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main(process.argv.slice(2));
