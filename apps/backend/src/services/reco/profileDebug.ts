import { getPrisma } from "../db";
import { ANIME_UNIVERSE_KEY } from "./facets";

/** Le profil stocké, facettes parsées — l'endpoint de debug du moteur, pas une UI. */
export async function getProfileDebug(userId: string): Promise<{
  exists: boolean;
  signalCount: number;
  ratingMean: number;
  ratingStdDev: number;
  /** Part d'animé dans les signaux de consommation (0..1). */
  animeShare: number;
  /** Poids de la facette universe:anime dans le vecteur (IDF compris). */
  animeWeight: number;
  computedAt: string | null;
  topFacets: Array<{ key: string; weight: number }>;
}> {
  const prisma = getPrisma();
  const row = await prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } });
  if (!row) {
    return {
      exists: false,
      signalCount: 0,
      ratingMean: 0,
      ratingStdDev: 0,
      animeShare: 0,
      animeWeight: 0,
      computedAt: null,
      topFacets: [],
    };
  }
  let facets: Record<string, number> = {};
  try {
    facets = JSON.parse(row.facets) as Record<string, number>;
  } catch {
    // Vecteur illisible : le debug montre un profil vide, le prochain rebuild réécrit.
  }
  const topFacets = Object.entries(facets)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 50)
    .map(([key, weight]) => ({ key, weight }));
  return {
    exists: true,
    signalCount: row.signalCount,
    ratingMean: row.ratingMean,
    ratingStdDev: row.ratingStdDev,
    animeShare: row.animeShare,
    animeWeight: facets[ANIME_UNIVERSE_KEY] ?? 0,
    computedAt: row.computedAt.toISOString(),
    topFacets,
  };
}
