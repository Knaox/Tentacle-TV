/* ------------------------------------------------------------------ */
/*  yt-dlp à jour — YouTube le casse toutes les quelques semaines      */
/*                                                                     */
/*  L'image embarque le zipapp OFFICIEL épinglé (/usr/local/bin/yt-dlp, */
/*  vérifié par SHA-256 au build ; l'app Windows le sien,              */
/*  TENTACLE_YTDLP_PINNED — services/tools/toolPaths.ts). Au démarrage  */
/*  puis toutes les 24 h, la dernière version officielle est posée dans */
/*  un chemin inscriptible, UNE COPIE PAR VERSION                       */
/*  (<data>/tools/yt-dlp-<version>) — somme SHA-256 de la release       */
/*  EXIGÉE, puis `--version` contrôlé avant de basculer. Jamais un      */
/*  renommage par-dessus la copie en service : sous Windows, l'ouvrier  */
/*  qui la tient ouverte le ferait échouer (EPERM). Tout échec laisse   */
/*  la copie précédente, ou l'épinglé. TENTACLE_YTDLP_AUTOUPDATE : « 0 » */
/*  coupe tout (l'épinglé seul), « 1 » l'active hors production.       */
/* ------------------------------------------------------------------ */

import { execFile } from "child_process";
import { createHash } from "crypto";
import { chmod, mkdir, rm, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "./dataDir";
import { pinnedYtDlpPath, ytDlpInvocation } from "./tools/toolPaths";

const TOOLS_DIR = resolve(DATA_ROOT, "tools");
/** La copie d'avant les copies par version : reprise telle quelle si c'est tout ce qu'il y a. */
const LEGACY_COPY = resolve(TOOLS_DIR, "yt-dlp");
const COPY_PREFIX = "yt-dlp-";
const RELEASES = "https://github.com/yt-dlp/yt-dlp/releases";
const DAY_MS = 24 * 60 * 60 * 1000;

/** La commande à lancer : la copie à jour une fois validée, sinon l'épinglé (ou `yt-dlp` du PATH, en développement). */
let active = existsSync(pinnedYtDlpPath()) ? pinnedYtDlpPath() : "yt-dlp";

export function ytDlpCommand(): string {
  return active;
}

/** La mise à jour tourne-t-elle ? « 0 » gagne toujours ; hors production, seulement sur « 1 ». */
export function autoUpdateEnabled(env: string | undefined, nodeEnv: string | undefined, hasPinned: boolean): boolean {
  if (env === "0") return false;
  if (env === "1") return true;
  return nodeEnv === "production" && hasPinned;
}

/** La version d'une release, lue dans la redirection de `/releases/latest` (…/tag/2026.08.19). */
export function tagFromLocation(location: string | null): string | null {
  const m = location?.match(/\/releases\/tag\/([\w.-]+)$/);
  return m ? m[1] : null;
}

/** La somme du zipapp `yt-dlp` dans le fichier SHA2-256SUMS d'une release. */
export function zipappChecksum(sums: string): string | null {
  for (const line of sums.split("\n")) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === "yt-dlp" && /^[0-9a-f]{64}$/.test(hash ?? "")) return hash;
  }
  return null;
}

/** « 2026.08.19.1 » → nombres comparables ; vide pour une étiquette illisible. */
function versionKey(tag: string): number[] {
  return /^\d+(\.\d+)*$/.test(tag) ? tag.split(".").map(Number) : [];
}

export function compareTags(a: string, b: string): number {
  const ka = versionKey(a);
  const kb = versionKey(b);
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const diff = (ka[i] ?? -1) - (kb[i] ?? -1);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Les copies par version parmi des noms de fichiers, la plus récente d'abord. */
export function versionedCopies(names: string[]): string[] {
  return names
    .filter((name) => name.startsWith(COPY_PREFIX) && versionKey(name.slice(COPY_PREFIX.length)).length > 0)
    .sort((a, b) => compareTags(b.slice(COPY_PREFIX.length), a.slice(COPY_PREFIX.length)));
}

function versionOf(file: string): Promise<string | null> {
  const { file: program, args } = ytDlpInvocation(file);
  return new Promise((done) => {
    execFile(program, [...args, "--version"], { timeout: 30_000 }, (err, stdout) => done(err ? null : stdout.trim() || null));
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

async function latestTag(): Promise<string | null> {
  const res = await fetch(`${RELEASES}/latest`, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  return tagFromLocation(res.headers.get("location"));
}

/** La copie en place : la plus récente par version, sinon celle d'avant les versions. */
function currentCopy(): string | null {
  const newest = existsSync(TOOLS_DIR) ? versionedCopies(readdirSync(TOOLS_DIR))[0] : undefined;
  if (newest) return resolve(TOOLS_DIR, newest);
  return existsSync(LEGACY_COPY) ? LEGACY_COPY : null;
}

/** Les autres copies : effacées si personne ne les tient, sinon au prochain passage. */
async function pruneExcept(keep: string): Promise<void> {
  for (const name of [...versionedCopies(readdirSync(TOOLS_DIR)), "yt-dlp"]) {
    const file = resolve(TOOLS_DIR, name);
    if (file !== keep) await rm(file, { force: true }).catch(() => undefined);
  }
}

/** Pose la dernière version si elle diffère de la copie en place. */
async function refresh(): Promise<void> {
  const copy = currentCopy();
  const current = copy ? await versionOf(copy) : null;
  if (copy && current) active = copy;
  const tag = await latestTag();
  if (!tag || tag === current) {
    // Une copie plus ancienne qu'une mise à jour n'avait pas pu effacer (tenue ouverte) part maintenant.
    if (copy && current) await pruneExcept(copy);
    return;
  }
  if (versionKey(tag).length === 0) throw new Error(`étiquette de yt-dlp illisible : ${tag}`);

  const expected = zipappChecksum(await fetchText(`${RELEASES}/download/${tag}/SHA2-256SUMS`));
  if (!expected) throw new Error(`pas de somme SHA-256 pour yt-dlp ${tag}`);
  const res = await fetch(`${RELEASES}/download/${tag}/yt-dlp`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`yt-dlp ${tag} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (createHash("sha256").update(body).digest("hex") !== expected) throw new Error(`somme de yt-dlp ${tag} invalide`);

  await mkdir(TOOLS_DIR, { recursive: true });
  const next = resolve(TOOLS_DIR, `${COPY_PREFIX}${tag}`);
  await writeFile(next, body);
  await chmod(next, 0o755);
  if ((await versionOf(next)) !== tag) {
    await rm(next, { force: true });
    throw new Error(`yt-dlp ${tag} ne répond pas à --version`);
  }
  // Bascule : les extractions suivantes prennent la nouvelle copie (l'ouvrier
  // se relance de lui-même sur un autre fichier) ; l'ancienne part dès qu'elle est libre.
  active = next;
  await pruneExcept(next);
  console.log(`[yt-dlp] ${current ?? "épinglé"} → ${tag}`);
}

let started = false;

/** Démarre la mise à jour (une fois) : tout de suite, puis toutes les 24 h. */
export function startYtDlpUpdates(): void {
  if (started) return;
  started = true;
  if (!autoUpdateEnabled(process.env.TENTACLE_YTDLP_AUTOUPDATE, process.env.NODE_ENV, existsSync(pinnedYtDlpPath()))) return;
  const run = () => {
    refresh().catch((err) => {
      console.warn(`[yt-dlp] mise à jour impossible (${active === pinnedYtDlpPath() ? "épinglé" : "copie précédente"} gardé) :`, err?.message ?? err);
    });
  };
  run();
  setInterval(run, DAY_MS).unref();
}
