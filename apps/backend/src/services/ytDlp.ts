/* ------------------------------------------------------------------ */
/*  yt-dlp à jour — YouTube le casse toutes les quelques semaines      */
/*                                                                     */
/*  L'image embarque le zipapp OFFICIEL épinglé (/usr/local/bin/yt-dlp, */
/*  vérifié par SHA-256 au build). Au démarrage puis toutes les 24 h,   */
/*  la dernière version officielle est posée dans un chemin inscriptible */
/*  (<data>/tools/yt-dlp) — somme SHA-256 de la release EXIGÉE, puis     */
/*  `--version` contrôlé avant tout remplacement, atomique. Tout échec   */
/*  laisse la copie précédente, ou l'épinglé. TENTACLE_YTDLP_AUTOUPDATE : */
/*  « 0 » coupe tout (l'épinglé seul), « 1 » l'active hors production.   */
/* ------------------------------------------------------------------ */

import { execFile } from "child_process";
import { createHash } from "crypto";
import { chmod, mkdir, rename, rm, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve } from "path";
import { DATA_ROOT } from "./dataDir";

const PINNED = "/usr/local/bin/yt-dlp";
const TOOLS_DIR = resolve(DATA_ROOT, "tools");
const COPY = resolve(TOOLS_DIR, "yt-dlp");
const RELEASES = "https://github.com/yt-dlp/yt-dlp/releases";
const DAY_MS = 24 * 60 * 60 * 1000;

/** La commande à lancer : la copie à jour une fois validée, sinon celle du PATH (l'épinglé). */
let active = "yt-dlp";

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

function versionOf(file: string): Promise<string | null> {
  return new Promise((done) => {
    execFile(file, ["--version"], { timeout: 30_000 }, (err, stdout) => done(err ? null : stdout.trim() || null));
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

/** Pose la dernière version si elle diffère de la copie en place ; rend la commande retenue. */
async function refresh(): Promise<void> {
  const current = existsSync(COPY) ? await versionOf(COPY) : null;
  if (current) active = COPY;
  const tag = await latestTag();
  if (!tag || tag === current) return;

  const expected = zipappChecksum(await fetchText(`${RELEASES}/download/${tag}/SHA2-256SUMS`));
  if (!expected) throw new Error(`pas de somme SHA-256 pour yt-dlp ${tag}`);
  const res = await fetch(`${RELEASES}/download/${tag}/yt-dlp`, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`yt-dlp ${tag} → ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (createHash("sha256").update(body).digest("hex") !== expected) throw new Error(`somme de yt-dlp ${tag} invalide`);

  await mkdir(TOOLS_DIR, { recursive: true });
  const next = `${COPY}.next`;
  await writeFile(next, body);
  await chmod(next, 0o755);
  if ((await versionOf(next)) !== tag) {
    await rm(next, { force: true });
    throw new Error(`yt-dlp ${tag} ne répond pas à --version`);
  }
  await rename(next, COPY);
  active = COPY;
  console.log(`[yt-dlp] ${current ?? "épinglé"} → ${tag}`);
}

let started = false;

/** Démarre la mise à jour (une fois) : tout de suite, puis toutes les 24 h. */
export function startYtDlpUpdates(): void {
  if (started) return;
  started = true;
  if (!autoUpdateEnabled(process.env.TENTACLE_YTDLP_AUTOUPDATE, process.env.NODE_ENV, existsSync(PINNED))) return;
  const run = () => {
    refresh().catch((err) => {
      console.warn(`[yt-dlp] mise à jour impossible (${active === COPY ? "copie précédente" : "épinglé"} gardé) :`, err?.message ?? err);
    });
  };
  run();
  setInterval(run, DAY_MS).unref();
}
