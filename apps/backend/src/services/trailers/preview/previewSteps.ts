/* ------------------------------------------------------------------ */
/*  Les gestes d'une décision d'aperçu                                 */
/*                                                                     */
/*  Partagés par le survol (`previewDecision.ts`) et la préparation en */
/*  fond des titres à l'écran (`previewWarm.ts`) : la clé de la        */
/*  décision, la vidéo qui se laisse LIRE (extraite, maître et         */
/*  premières listes lus), le garde-fou de YouTube, et la décision     */
/*  retenue. Les deux chemins prennent ainsi la même décision.         */
/* ------------------------------------------------------------------ */

import type { TrailerCatalogRequest, TrailerVersion } from "../../../trailers/trailerCatalog";
import { playedTrailerVersion } from "../../../trailers/trailerCatalogRank";
import { resolveTrailer, type ResolvedTrailer } from "../trailerRelay";
import { holdsSource, peekTrailer, prepareTrailer, warmStart } from "../trailerPrepare";
import type { ExtractionOptions } from "../ytExtract";
import { previewRefusal } from "../youtubeGuard";
import { remember, type Refusal } from "./previewDecisionMemory";

/** Ce qu'un aperçu demande : sa clé de décision (`jf:<id>`, `tmdb:movie:<id>`) et la demande de catalogue. */
export interface PreviewTarget {
  key: string;
  catalog: TrailerCatalogRequest;
}

export type PreviewOutcome =
  | { kind: "found"; ref: string; resolved: ResolvedTrailer; version?: TrailerVersion }
  | { kind: "refused"; error: Refusal }
  /** Trop de demandes (le compte), trop de décisions en cours (le serveur), ou pas encore décidé : rien n'est retenu. */
  | { kind: "limited"; retryAfterS: number };

/**
 * La version des RÈGLES de choix, dans la clé : une décision d'avant (rang du
 * catalogue d'avant, vidéo d'un autre titre, doublage par IA compté comme une
 * VF — r5) ne sert plus.
 */
export const RULES_VERSION = "r6";

/**
 * La clé de la décision : le titre, la langue, les règles, et le client —
 * celui qui lit Dailymotion (`dm=1`) a sa décision à part de celle d'un client
 * d'avant.
 */
export function decisionKey(target: PreviewTarget, lang: string | undefined, dailymotion: boolean): string {
  return `${target.key}|${lang ?? "-"}|${RULES_VERSION}${dailymotion ? "|dm" : ""}`;
}

/** Où passe le temps d'une décision (ms), pour le journal : de quoi savoir quoi accélérer. */
export interface Stages {
  catalog: number;
  extract: number;
  verify: number;
}

export const newStages = (): Stages => ({ catalog: 0, extract: 0, verify: 0 });

/** Le départ du lecteur au plus haut — listes et premiers segments — lu d'avance, sans rien attendre. */
export function warmPlayerStart(ref: string): void {
  void warmStart(ref).catch(() => undefined);
}

export interface PlayableOptions extends ExtractionOptions {
  /** La vidéo que le relais TIENT, ou rien : jamais d'extraction (la préparation, pour YouTube). */
  heldOnly?: boolean;
  /**
   * Lire d'avance le départ du lecteur (listes et premiers segments), pour un
   * survol qui l'attend. La préparation s'en passe : quarante titres à
   * l'écran rempliraient la mémoire des débuts pour rien.
   */
  startWarm?: boolean;
}

/**
 * La vidéo se laisse-t-elle lire : extraite, puis son maître et ses premières
 * listes lus ? Le départ au plus haut part EN MÊME TEMPS (même maître, lu une
 * fois) et ne retarde pas la réponse.
 */
export async function playable(ref: string, stages: Stages, options: PlayableOptions, fresh = false): Promise<ResolvedTrailer | null> {
  const { startWarm = true, ...resolveOptions } = options;
  const held = !fresh && holdsSource(ref);
  let mark = Date.now();
  const resolved = await resolveTrailer(ref, fresh ? { ...resolveOptions, fresh } : resolveOptions);
  stages.extract += Date.now() - mark;
  if (!resolved) return null;
  if (startWarm) warmPlayerStart(ref);
  mark = Date.now();
  const readable = await prepareTrailer(ref, resolveOptions);
  stages.verify += Date.now() - mark;
  // Relu : le maître lu dit la piste audio retenue (`hlsAudio.ts`).
  if (readable) return peekTrailer(ref) ?? resolved;
  // Une source GARDÉE (d'avant un redémarrage, ou révoquée) qui ne se lit plus : une extraction neuve, une seule —
  // jamais pour qui ne veut que la vidéo tenue.
  return held && !options.heldOnly ? playable(ref, stages, options, true) : null;
}

/**
 * Le garde-fou YouTube interdit-il d'extraire pour un aperçu ? Suspendu :
 * « aucune lisible », sans rien retenir par titre ; budget de l'heure
 * épuisé : « réessayez » dans le délai honnête.
 */
export function guardStop(): PreviewOutcome | null {
  const refusal = previewRefusal();
  if (!refusal) return null;
  if (refusal.kind === "blocked") return { kind: "refused", error: "unavailable" };
  return { kind: "limited", retryAfterS: Math.max(1, Math.ceil(refusal.retryAfterMs / 1000)) };
}

/**
 * La version de ce qu'on entendra : celle du catalogue, corrigée par la piste
 * que le relais joue (`playedTrailerVersion`) — un doublage par IA n'est
 * jamais une VF, et le relais ne le joue jamais.
 */
export function heardVersion(claimed: TrailerVersion, resolved: ResolvedTrailer, lang: string | undefined): TrailerVersion {
  return playedTrailerVersion(claimed, resolved.audio, lang);
}

/** La décision retenue jusqu'à l'échéance des URL (`maxTtlMs` au plus), et sa ligne au journal. */
export function found(
  key: string, ref: string, resolved: ResolvedTrailer, started: number, how: string, stages: Stages,
  { maxTtlMs = Infinity, version }: { maxTtlMs?: number; version?: TrailerVersion } = {},
): PreviewOutcome {
  remember(key, version ? { kind: "found", ref, version } : { kind: "found", ref }, Math.min(resolved.validUntil - Date.now(), maxTtlMs));
  const detail = `catalogue ${stages.catalog}, extraction ${stages.extract}, vérification ${stages.verify}`;
  console.log(`[trailers] aperçu ${key} : ${ref} (${resolved.kind}, ${resolved.heights[0] ?? "mp4"}) en ${Date.now() - started} ms (${detail}), ${how}`);
  return version ? { kind: "found", ref, resolved, version } : { kind: "found", ref, resolved };
}
