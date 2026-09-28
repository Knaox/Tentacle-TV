import { getPrisma } from "../db";
import { parseAnchors, parsePotentials } from "./anchorStore";
import { ANIME_UNIVERSE_KEY } from "./facets";

/** Ancres montrées par le debug : les plus fortes, positives et négatives. */
const DEBUG_ANCHORS = 40;

/** Le profil stocké, facettes parsées — l'endpoint de debug du moteur, pas une UI. */
export async function getProfileDebug(userId: string): Promise<{
  exists: boolean;
  schemaVersion: number;
  signalCount: number;
  ratingMean: number;
  ratingStdDev: number;
  /** Part d'animé dans le temps de visionnage (0..1). */
  animeShare: number;
  /** Poids de la facette universe:anime dans le vecteur (IDF compris). */
  animeWeight: number;
  computedAt: string | null;
  topFacets: Array<{ key: string; weight: number }>;
  /** Nombre d'ancres (titres pondérés) — 0 pour un profil d'avant les ancres. */
  anchorCount: number;
  topAnchors: Array<{ key: string; title: string; weight: number; kinds: string[]; hours: number }>;
  /** Titres seulement dans Ma liste : connus, sans poids (null = profil d'avant la v5). */
  potentialCount: number | null;
  potentials: Array<{ key: string; title: string }>;
}> {
  const prisma = getPrisma();
  const row = await prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } });
  if (!row) {
    return {
      exists: false,
      schemaVersion: 0,
      signalCount: 0,
      ratingMean: 0,
      ratingStdDev: 0,
      animeShare: 0,
      animeWeight: 0,
      computedAt: null,
      topFacets: [],
      anchorCount: 0,
      topAnchors: [],
      potentialCount: null,
      potentials: [],
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
  const anchors = parseAnchors(row.anchors) ?? [];
  const potentials = parsePotentials(row.potentials);
  return {
    exists: true,
    schemaVersion: row.schemaVersion,
    signalCount: row.signalCount,
    ratingMean: row.ratingMean,
    ratingStdDev: row.ratingStdDev,
    animeShare: row.animeShare,
    animeWeight: facets[ANIME_UNIVERSE_KEY] ?? 0,
    computedAt: row.computedAt.toISOString(),
    topFacets,
    anchorCount: anchors.length,
    topAnchors: anchors.slice(0, DEBUG_ANCHORS).map((a) => ({
      key: a.key,
      title: a.title,
      weight: Math.round(a.weight * 1000) / 1000,
      kinds: a.kinds,
      hours: a.hours,
    })),
    potentialCount: potentials ? potentials.length : null,
    potentials: (potentials ?? []).slice(0, DEBUG_ANCHORS).map((p) => ({ key: p.key, title: p.title })),
  };
}
