import { getPrisma } from "../../db";
import type { Candidate } from "../scoring/strategy";

/**
 * Recommandations AniList sur les animés notés.
 *
 * Volontairement inerte tant que la correspondance d'identifiants n'existe pas
 * (Phase 9 : mapping Fribb/anime-lists + repli recherche) : une reco AniList
 * arrive avec un id AniList, et sans anilistId → tmdbId fiable, impossible de
 * la dédupliquer, l'exclure ou la router. Brancher ici, ne rien bricoler avant.
 */
export async function candidatesFromAnilist(userId: string): Promise<Candidate[]> {
  const prisma = getPrisma();
  const ratedAnime = await prisma.userRating.count({
    where: { jellyfinUserId: userId, deletedAt: null, isAnime: true, anilistId: { not: null } },
  });
  // Le jour où des animés mappés existent, la Phase 9 remplit cette source.
  void ratedAnime;
  return [];
}
