// Les deux codes que le banc fait tourner : le dossier COURANT (la
// refactorisation en cours) et le code de RÉFÉRENCE (un commit, avant toute
// refactorisation), extrait une fois dans le cache de la machine et partagé
// par toutes les sessions.
//
// Ni l'un ni l'autre n'installe de dépendances : les node_modules sont ceux du
// dossier principal, liés paquet par paquet. Les liens `@tentacle-tv/*` restent
// RELATIFS (ils visent les paquets du checkout lui-même : le tv-core de
// référence, pas celui du principal) ; tout le reste vise le principal.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BenchError, CACHE_DIR, REPO, capture, mainCheckout, note, resolveSha, sleep, step } from "./config.mjs";

// Ce que l'app TV lit (JS, natif, configuration) : rien d'autre n'est extrait.
const ARCHIVED = ["apps/tv", "packages", "versions.json", "package.json", "pnpm-workspace.yaml", "tsconfig.base.json", ".npmrc", "patches"];
// Les paquets dont les node_modules comptent pour l'app TV (et son build).
const PACKAGE_DIRS = (root) => ["apps/tv", ...fs.readdirSync(path.join(root, "packages")).map((name) => `packages/${name}`)];

/** Le dossier courant : celui qui porte le banc (ses node_modules par paquet prêtés au besoin). */
export function currentCheckout() {
  linkNodeModules(REPO);
  const sha = capture("git", ["-C", REPO, "rev-parse", "HEAD"])?.trim() ?? null;
  const dirty = (capture("git", ["-C", REPO, "status", "--porcelain", "--", "apps/tv", "packages"]) ?? "").trim() !== "";
  return { dir: REPO, sha, dirty, label: `dossier courant (${sha?.slice(0, 9) ?? "?"}${dirty ? ", modifié" : ""})` };
}

/** Un verrou de machine (un dossier : `mkdir` est atomique), repris s'il a plus de `staleMs`. */
export async function withLock(name, fn, { staleMs = 45 * 60_000, waitMs = 60 * 60_000 } = {}) {
  const lock = path.join(CACHE_DIR, "locks", name);
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const start = Date.now();
  let announced = false;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      fs.writeFileSync(path.join(lock, "owner"), `${process.pid} ${new Date().toISOString()} ${REPO}\n`);
      break;
    } catch {
      const age = Date.now() - (fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
      if (age > staleMs) {
        fs.rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() - start > waitMs) throw new BenchError(`verrou « ${name} » tenu depuis trop longtemps (${lock})`);
      if (!announced) note(`une autre session prépare « ${name} » — on attend son verrou`);
      announced = true;
      await sleep(3000);
    }
  }
  try {
    return await fn();
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/** Le code d'un commit, extrait dans le cache (une fois par commit, pour toute la machine). */
export async function referenceCheckout(rev) {
  const sha = resolveSha(rev);
  if (!sha) throw new BenchError(`révision inconnue : ${rev}`);
  const dir = path.join(CACHE_DIR, "checkouts", sha.slice(0, 12));
  const ready = path.join(dir, ".nav-golden-ready");
  if (!fs.existsSync(ready)) {
    await withLock(`checkout-${sha.slice(0, 12)}`, async () => {
      if (fs.existsSync(ready)) return;
      step("Référence", `extraction de ${sha.slice(0, 9)} dans le cache (une fois pour toute la machine)`);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const tar = execFileSync("git", ["-C", REPO, "archive", "--format=tar", sha, "--", ...ARCHIVED], { maxBuffer: 1 << 30 });
      execFileSync("tar", ["-x", "-C", dir], { input: tar });
      fs.writeFileSync(ready, `${sha}\n`);
    });
  }
  linkNodeModules(dir);
  return { dir, sha, dirty: false, label: `référence ${sha.slice(0, 9)}` };
}

/** Un lien symbolique, posé seulement s'il n'y a rien à cet endroit. */
function ensureLink(target, at) {
  if (fs.lstatSync(at, { throwIfNoEntry: false })) return false;
  fs.mkdirSync(path.dirname(at), { recursive: true });
  try {
    fs.symlinkSync(target, at);
  } catch (error) {
    // Une autre session l'a posé au même instant (checkout de référence partagé).
    if (error.code === "EEXIST") return false;
    throw error;
  }
  return true;
}

/**
 * Les node_modules du principal, prêtés au checkout `dir`. Idempotent, et
 * n'efface jamais rien : ce qui existe déjà (une vraie installation dans un
 * worktree) est laissé tel quel.
 */
export function linkNodeModules(dir) {
  const main = mainCheckout();
  if (path.resolve(dir) === path.resolve(main)) return 0;
  let made = 0;
  if (ensureLink(path.join(main, "node_modules"), path.join(dir, "node_modules"))) made++;
  for (const pkg of PACKAGE_DIRS(dir)) {
    const from = path.join(main, pkg, "node_modules");
    if (!fs.existsSync(from) || !fs.existsSync(path.join(dir, pkg))) continue;
    made += mirrorEntries(from, path.join(dir, pkg, "node_modules"));
  }
  if (made) note(`node_modules du principal liés dans ${path.relative(path.dirname(dir), dir)} (${made} liens)`);
  return made;
}

function mirrorEntries(from, to) {
  let made = 0;
  if (fs.lstatSync(to, { throwIfNoEntry: false })?.isSymbolicLink()) return 0; // déjà prêté en bloc
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    if (entry === ".DS_Store") continue;
    const source = path.join(from, entry);
    const stat = fs.lstatSync(source);
    if (entry.startsWith("@") && stat.isDirectory()) {
      made += mirrorEntries(source, path.join(to, entry));
    } else if (stat.isSymbolicLink() && !path.isAbsolute(fs.readlinkSync(source))) {
      // Un paquet du dépôt (`../../packages/x`) : le même lien relatif, qui
      // vise donc le paquet DU CHECKOUT.
      if (ensureLink(fs.readlinkSync(source), path.join(to, entry))) made++;
    } else if (ensureLink(source, path.join(to, entry))) {
      made++;
    }
  }
  return made;
}

/** Les dossiers que Metro doit surveiller pour servir les node_modules prêtés. */
export function borrowedNodeModules(dir) {
  const main = mainCheckout();
  if (path.resolve(dir) === path.resolve(main)) return [];
  return [path.join(main, "node_modules"), ...PACKAGE_DIRS(main).map((pkg) => path.join(main, pkg, "node_modules"))]
    .filter((folder) => fs.existsSync(folder));
}
