import type { LibraryIndex } from "./candidates/libraryIndex";
import { libraryCandidates } from "./candidates/librarySource";
import { assemblePool } from "./candidates/pool";
import { candidatesFromPeople } from "./candidates/peopleSource";
import { candidatesFromCreators } from "./candidates/creatorSource";
import { candidatesFromDiscover, candidatesFromSeeds } from "./candidates/tmdbSource";
import { candidatesFromVigie } from "./candidates/vigieSource";
import { candidatesFromVigieDiscover } from "./candidates/vigieDiscover";
import { candidatesFromAnimeDiscover } from "./candidates/animeSource";
import { applyCachedMeta } from "./poolEnrichment";
import { applyNeighborSupport, candidatesFromNeighbors } from "./poolTaste";
import type { PoolTaste } from "./poolTaste";
import type { Candidate, TasteVector } from "./scoring/strategy";

export interface GatherOptions {
  /** Passe rapide : aucune source réseau, la relève complète suivra. */
  quick: boolean;
  includeVigie: boolean;
  animeShare: number;
  likedPeople: Array<{ personId: number; name: string }>;
  profile: TasteVector;
  library: LibraryIndex;
  taste: PoolTaste;
  /** Ce que Vigie propose pour ce goût ; absent : la découverte de Jellyseerr (cf. vigieDiscover). */
  vigieSource?: (profile: TasteVector) => Promise<Candidate[]>;
}

/**
 * Le panier de candidats d'un compte, prêt à classer : toutes les sources,
 * dédupliquées, rattachées à la bibliothèque, décrites par leurs facettes
 * COMPLÈTES (cache TMDB) et portant le soutien de leurs graines et ancres.
 */
async function defaultVigieSource(profile: TasteVector): Promise<Candidate[]> {
  const [discover, featured] = await Promise.all([candidatesFromVigieDiscover(profile).catch(() => []), candidatesFromVigie()]);
  return [...discover, ...featured];
}

export async function gatherCandidates(opts: GatherOptions): Promise<Candidate[]> {
  const { quick, includeVigie, library, taste } = opts;
  // Sources — bibliothèque d'abord (elle porte jellyfinItemId), puis les
  // découvertes. Chaque source dégrade en liste vide, jamais en erreur.
  // Bibliothèque seule : /discover et Vigie ne produisent QUE du hors
  // bibliothèque — on économise l'API. Les graines restent interrogées :
  // leurs candidats se rattachent à la bibliothèque et portent les seedKey
  // des rangées « Parce que vous avez aimé ». En passe rapide : aucune source
  // externe du tout, le réseau attendra la relève.
  // La source « personnes » tourne même en bibliothèque seule : comme les
  // graines, ses candidats peuvent se rattacher à la bibliothèque — le filtre
  // de service fait foi.
  const [fromSeeds, fromAnime, fromPeople, fromDiscover, fromVigie, fromAuthors] = quick
    ? [[], [], [], [], [], []]
    : await Promise.all([
        candidatesFromSeeds(taste.seeds),
        // Univers animé : gardé par includeVigie comme /discover (il ne produit
        // que du hors bibliothèque) et, en interne, par la part d'animé.
        includeVigie ? candidatesFromAnimeDiscover(opts.animeShare) : Promise.resolve([]),
        candidatesFromPeople(opts.likedPeople),
        includeVigie ? candidatesFromDiscover(opts.profile) : Promise.resolve([]),
        // Vigie : la découverte de Jellyseerr réglée par CE goût, puis ce qu'il met en avant.
        includeVigie ? (opts.vigieSource ?? defaultVigieSource)(opts.profile) : Promise.resolve([]),
        // Les auteurs de ce qu'il adore : comme les personnes, aussi en bibliothèque seule.
        candidatesFromCreators(taste.lovedAuthors),
      ]);

  // Les voisins collaboratifs des ancres : cache seul, donc dès la passe rapide.
  const fromNeighbors = await candidatesFromNeighbors(taste);

  // L'animé juste après les graines : le plafond d'assemblage (POOL_MAX) coupe
  // les sources tardives, et celle-ci n'existe que pour être servie.
  const pool = assemblePool([
    libraryCandidates(library),
    fromSeeds,
    fromNeighbors,
    fromAnime,
    fromPeople,
    fromAuthors,
    fromVigie,
    fromDiscover,
  ]);

  // Un candidat externe déjà en bibliothèque récupère son jellyfinItemId :
  // c'est lui qui décide de la navigation (fiche Jellyfin, pas fiche Vigie).
  for (const candidate of pool) {
    if (!candidate.jellyfinItemId) {
      const entry = library.byKey.get(candidate.key);
      if (entry) candidate.jellyfinItemId = entry.itemId;
    }
  }

  // Facettes complètes pour TOUT le panier (cache seul), et le soutien des
  // ancres qui recommandent chaque candidat, d'où qu'il vienne.
  await applyCachedMeta(pool);
  applyNeighborSupport(pool, taste);
  return pool;
}
