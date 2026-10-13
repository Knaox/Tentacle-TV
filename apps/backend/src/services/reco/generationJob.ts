import { getPrisma } from "../db";
import { awaitRebuild } from "./profileBuilder";
import { idfLoadedAt, loadIdfFromDb } from "./idfStore";
import type { Candidate, ScoreBreakdown } from "./scoring/strategy";
import { buildExclusions } from "./candidates/exclusions";
import { getLibraryIndexMemo } from "./candidates/libraryMemo";
import type { SeedRef } from "./candidates/tmdbSource";
import { isPoolStale, readPoolStamp, writePool } from "./poolStore";
import type { PoolStamp } from "./poolStore";
import { AttemptGate } from "./attemptGate";
import { emitPoolWritten } from "./recoEvents";
import { enqueueFromPool } from "./metaCrawler";
import { getSeerrConfig } from "../seerConfig";
import { effectiveIncludeVigie } from "./vigieSetting";
import { computePool } from "./poolCompute";

// Lecture/écriture/invalidation du pool : extraites dans poolStore, ré-exportées
// ici pour ne pas casser les importeurs historiques.
export { POOL_ROW_KEY, readPool } from "./poolStore";

export interface PoolEntry {
  candidate: Candidate;
  breakdown: ScoreBreakdown;
  /** Ids TMDB des offres INCLUSES (région de génération) — null ou absent =
   *  disponibilité inconnue (le crawler la comblera), [] = aucune offre. Des
   *  ids seuls : nom et logo se reconstituent à l'annuaire au service. */
  providers?: number[] | null;
  /** Correspondance 0..100, monotone avec le rang dans le pool (95 en tête, 50 en queue). */
  match?: number;
}

export interface PoolPayload {
  generatedAt: string;
  strategyId: string;
  poolSize: number;
  /** Réglage au moment de la génération (debug) — additif, vieux pools sans. */
  includeVigie?: boolean;
  /** Passe rapide (bibliothèque + cache, zéro réseau) : la relève complète
   *  l'écrase — additif, un vieux pool sans le champ est complet. */
  preliminary?: boolean;
  /** Part d'animé du profil à la génération (0..1) — pilote le quota des
   *  rangées mixtes et la rangée dédiée ; additif, un vieux pool vaut 0. */
  animeShare?: number;
  /** Aversion apprise par univers (0..1) — rangées globales et exploration la lisent ;
   *  additif, un vieux pool n'en a pas. */
  aversion?: Record<string, number>;
  /** Personnes que le compte adore (rangées d'auteur, raisons « Avec … ») ; additif. */
  lovedPeople?: Array<{ key: string; id: number; name: string; role: "actor" | "director" | "creator"; count: number }>;
  /** Personnes aimées au moment de la génération (rangées « Avec X »). */
  people?: Array<{ personId: number; name: string }>;
  /** Région des `providers` des entrées — différente de la région courante :
   *  ils sont à réapprendre (le crawler ré-enfile tout). Absent = vieux pool. */
  providersRegion?: string;
  seeds: SeedRef[];
  entries: PoolEntry[];
  /** Libellés humains des facettes à IDs (« director:5655 » → nom) pour les
   *  raisons affichées. Décennies/langues/durées se localisent côté client. */
  labels: Record<string, string>;
}

// Une génération à la fois par compte — la page peut marteler, le job non.
const inFlight = new Map<string, Promise<{ poolSize: number }>>();

/** Garde de FRÉQUENCE des relances déclenchées par une requête : un pool
 *  préliminaire dont la relève échoue (TMDB muet) repartait à chaque requête
 *  — donc sans cesse sous un client qui sonde. Deux minutes entre deux
 *  tentatives ; une génération réussie la libère. */
const poolKickGate = new AttemptGate(2 * 60_000);

export function isPoolGenerating(userId: string): boolean {
  return inFlight.has(userId);
}

export async function generatePool(userId: string): Promise<{ poolSize: number }> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = doGenerate(userId).finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

/**
 * Premier pool d'un compte : la passe RAPIDE part TOUT DE SUITE — même sur un
 * profil encore vide (le classement retombe sur qualité + fraîcheur : le
 * meilleur de la bibliothèque, montrable pendant que « on explore vos
 * goûts ») — puis la fin d'une reconstruction en cours est attendue et la
 * génération complète écrase la passe rapide. UNE seule chaîne sous le
 * mutex : deux requêtes simultanées ne lancent pas deux générations, et le
 * pool complet ne fige jamais un profil vide (il suit toujours le rebuild).
 */
export async function bootstrapPool(userId: string): Promise<{ poolSize: number }> {
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const p = (async () => {
    await doGenerate(userId, true).catch(() => undefined);
    await awaitRebuild(userId);
    return doGenerate(userId);
  })().finally(() => inFlight.delete(userId));
  inFlight.set(userId, p);
  return p;
}

async function doGenerate(userId: string, quick = false): Promise<{ poolSize: number }> {
  const prisma = getPrisma();
  if (idfLoadedAt() === 0) await loadIdfFromDb();

  const [profileRow, settingsRow, library, likedPeople] = await Promise.all([
    prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.recoSettings.findUnique({ where: { jellyfinUserId: userId } }),
    getLibraryIndexMemo(userId),
    prisma.userLikedPerson.findMany({
      where: { jellyfinUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { personId: true, name: true },
    }),
  ]);

  const includeVigie = effectiveIncludeVigie(settingsRow?.includeVigie, getSeerrConfig() !== null);
  const exclusions = await buildExclusions(userId, library);
  const { payload, providers } = await computePool({
    userId, quick, profileRow, includeVigie, library, likedPeople, exclusions,
  });
  if (!quick) {
    console.log(
      `[Reco] Pool ${userId.slice(0, 8)}… : ${payload.poolSize} entrées, plateformes connues ${providers.known}, inconnues ${providers.unknown}`
    );
  }
  await writePool(userId, payload);
  poolKickGate.release(userId);
  emitPoolWritten(userId);

  // Les plateformes inconnues partent au crawler — pas en passe rapide, que
  // la relève complète écrase dans la minute.
  if (!quick) void enqueueFromPool(userId, payload).catch(() => undefined);

  return { poolSize: payload.poolSize };
}

function kickInBackground(userId: string, work: (userId: string) => Promise<unknown>, what: string): void {
  if (!poolKickGate.tryAcquire(userId)) return;
  void work(userId).catch((err) =>
    console.error(`[Reco] ${what} du pool ${userId.slice(0, 8)}… en échec :`, err)
  );
}

/** Un pool PRÉLIMINAIRE est servi : la relève complète part en fond, sous
 *  la garde (le constructeur de page le sait, poolStatus ne lit pas le payload). */
export function requestPoolRelief(userId: string): void {
  kickInBackground(userId, generatePool, "Relève");
}

export interface PoolStatus {
  stamp: PoolStamp | null;
  /** Une génération est en vol pour ce compte. */
  generating: boolean;
  /** Le pool a passé sa fraîcheur (servi quand même, régénéré en fond). */
  stale: boolean;
}

/**
 * L'état du pool SANS lire son payload — le chemin chaud du service de page.
 * `kick` : absent → chaîne rapide+complète en fond, périmé → génération
 * complète en fond, sous la garde de fréquence. La requête n'attend jamais.
 */
export async function poolStatus(userId: string, opts: { kick: boolean }): Promise<PoolStatus> {
  const stamp = await readPoolStamp(userId);
  const stale = stamp !== null && isPoolStale(stamp.generatedAt);
  if (opts.kick) {
    if (!stamp) kickInBackground(userId, bootstrapPool, "Génération");
    else if (stale) kickInBackground(userId, generatePool, "Régénération");
  }
  return { stamp, generating: inFlight.has(userId), stale };
}

