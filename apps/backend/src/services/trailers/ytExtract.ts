/* ------------------------------------------------------------------ */
/*  L'extraction d'une bande-annonce par yt-dlp                        */
/*                                                                     */
/*  yt-dlp reste l'extracteur : YouTube change souvent, yt-dlp suit,   */
/*  et l'image le tient à jour (services/ytDlp.ts). On lui demande le  */
/*  JSON complet (`-j`) et l'on choisit nous-mêmes (trailerSource.ts) */
/*  — plus de sélection de format figée qui ignorait le maître HLS de  */
/*  `visionos` et retombait sur un MP4 coupé à 1 Mio (« plantent 2 fois */
/*  sur 3 », 2026-10-02).                                              */
/* ------------------------------------------------------------------ */

import { execFile } from "child_process";
import { ytDlpCommand } from "../ytDlp";
import { workerExtract } from "./ytWorker";
import { clientPasses, isPermanentFailure, pickTrailerSource, type TrailerSource, type YtFormat } from "./trailerSource";

/**
 * Les défis JavaScript de YouTube (« EJS ») : `visionos` s'en passe, mais
 * `web_embedded` (vidéos « pour enfants ») et les clients web en ont besoin —
 * moteur deno et solveur tiré de GitHub. Un yt-dlp trop ancien pour cette
 * option (sortie 2, erreur d'usage) est relancé sans elle, une fois pour toutes.
 */
const EJS_ARGS = ["--remote-components", "ejs:github"];
let ejsSupported = true;

/**
 * Une passe : page, API du lecteur, manifeste. Deux secondes d'ordinaire ; un
 * serveur lent en met plus. Deux passes tiennent sous les 45 s que le
 * téléviseur accorde à la résolution.
 */
const PASS_TIMEOUT_MS = 20_000;

/**
 * Deux extractions à la fois au plus : chacune est un processus Python, et
 * une fiche ouverte en déclenche une (préparation). Un défilement rapide de
 * fiches ne doit pas lancer dix processus sur un petit serveur.
 */
const MAX_CONCURRENT = 2;
let running = 0;
const queue: Array<() => void> = [];

async function withSlot<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((go) => queue.push(go));
  running++;
  try {
    return await task();
  } finally {
    running--;
    queue.shift()?.();
  }
}

interface PassOutcome {
  formats: YtFormat[];
  stderr: string;
}

const watchUrl = (ytId: string) => `https://www.youtube.com/watch?v=${ytId}`;

/** Une passe : par l'ouvrier gardé chaud quand il le peut, sinon en lançant yt-dlp. */
async function runPass(ytId: string, clients: string[]): Promise<PassOutcome | null> {
  const viaWorker = await workerExtract(ytDlpCommand(), { url: watchUrl(ytId), clients, ejs: ejsSupported }, PASS_TIMEOUT_MS);
  if (viaWorker.status === "done") return { formats: viaWorker.outcome.formats as YtFormat[], stderr: viaWorker.outcome.stderr };
  if (viaWorker.status === "failed") return { formats: [], stderr: `ERROR: ${viaWorker.reason}` };
  return runCli(ytId, clients);
}

function runCli(ytId: string, clients: string[]): Promise<PassOutcome | null> {
  const withEjs = ejsSupported;
  const args = [
    ...(withEjs ? EJS_ARGS : []),
    "--extractor-args", `youtube:player_client=${clients.join(",")}`,
    "-j",
    // Le JSON même sans format jouable : le choix et le diagnostic sont les nôtres.
    "--ignore-no-formats-error",
    "--no-playlist",
    "--no-warnings",
    "--socket-timeout", "10",
    watchUrl(ytId),
  ];
  return new Promise((resolve) => {
    execFile(ytDlpCommand(), args, { timeout: PASS_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && withEjs && (err as { code?: unknown }).code === 2) {
        ejsSupported = false;
        return resolve(runCli(ytId, clients));
      }
      try {
        const info = JSON.parse(stdout) as { formats?: YtFormat[] };
        resolve({ formats: info.formats ?? [], stderr });
      } catch {
        resolve(err ? { formats: [], stderr: `${stderr}\n${err.message}` } : null);
      }
    });
  });
}

export type ExtractionResult =
  | { ok: true; source: TrailerSource; clients: string[] }
  | { ok: false; permanent: boolean; reason: string };

/** Extrait le meilleur flux de `ytId`, passe après passe ; la première qui rend un flux gagne. */
export function extractTrailerSource(ytId: string): Promise<ExtractionResult> {
  return withSlot(async () => {
    let reason = "aucune passe";
    let permanent = false;
    for (const clients of clientPasses(process.env.TENTACLE_TRAILER_CLIENTS)) {
      const outcome = await runPass(ytId, clients);
      const source = outcome && pickTrailerSource(outcome.formats);
      if (source) return { ok: true, source, clients };
      const lastError = outcome?.stderr.split("\n").filter((l) => l.startsWith("ERROR")).pop();
      reason = lastError ?? `${clients.join(",")} : ${outcome ? `${outcome.formats.length} formats, aucun lisible` : "sortie illisible"}`;
      permanent = !!outcome && isPermanentFailure(outcome.stderr);
      // Une vidéo retirée ou privée l'est pour tous les clients : inutile d'insister.
      if (permanent) break;
    }
    return { ok: false, permanent, reason };
  });
}
