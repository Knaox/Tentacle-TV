import { getPrisma } from "../db";
import { tmdbConfigured } from "../tmdb/client";
import { canonicalKey } from "./candidates/exclusions";
import { rebuildProfile } from "./profileBuilder";
import type { TasteVector } from "./scoring/strategy";

// Démarrage à froid (spec) : < 5 signaux → pas de reco personnalisée du tout ;
// 5..14 → recos servies avec l'indicateur « vos recommandations s'affinent ».
const COLD_MIN_SIGNALS = 5;
const WARMING_MIN_SIGNALS = 15;

export type RecoState = "disabled" | "cold" | "warming" | "ready";

export interface ServeContext {
  state: RecoState;
  signalCount: number;
  lambda: number;
  includeVigie: boolean;
  community: boolean;
  exclude: Set<string>;
  profile: TasteVector;
  /** Premier contact : le profil se construit EN FOND, l'état est provisoire. */
  bootstrapping: boolean;
  /** La clé TMDB est l'interrupteur GLOBAL : absente → perso coupée pour tous. */
  tmdbConfigured: boolean;
  /** Le réglage brut du compte — la CAUSE d'un état « disabled » (clé absente
   *  ou choix de l'utilisateur) voyage dans ces deux booléens, pas dans l'enum. */
  personalized: boolean;
}

/**
 * Le contexte de service d'une requête reco : état du moteur, réglages,
 * exclusions du moment, profil parsé. Ne bloque JAMAIS : au premier contact
 * d'un compte (pas de ligne de profil), la reconstruction part en fond —
 * elle vaut 10-25 s de scans Jellyfin et de fetchs TMDB, pas une requête HTTP.
 */
export async function serveContext(userId: string): Promise<ServeContext> {
  const prisma = getPrisma();
  const profileRow = await prisma.tasteProfile.findUnique({ where: { jellyfinUserId: userId } });

  // Premier contact : « pas de ligne de profil » ne veut pas dire « pas de
  // goût » — un historique Jellyfin (vus, favoris, listes) porte déjà des
  // signaux. On répond « warming » tout de suite (aucune valeur d'état
  // nouvelle : mobile/TV switchent sur l'enum existant) ; l'état réel — cold
  // pour un compte réellement vierge — arrive au prochain poll du client.
  // Sans clé TMDB, pas de rebuild : le moteur est générique, inutile de payer
  // des scans pour un profil que personne ne servira tant que la clé manque.
  const tmdb = tmdbConfigured();
  const bootstrapping = tmdb && !profileRow;
  if (bootstrapping) {
    void rebuildProfile(userId).catch(() => {
      // Jellyfin muet : l'appel suivant retentera.
    });
  }

  const [settings, ratings, feedback] = await Promise.all([
    prisma.recoSettings.findUnique({ where: { jellyfinUserId: userId } }),
    prisma.userRating.findMany({
      where: { jellyfinUserId: userId, deletedAt: null },
      select: { mediaType: true, tmdbId: true },
    }),
    prisma.recommendationFeedback.findMany({
      where: { jellyfinUserId: userId },
      select: { itemKey: true },
    }),
  ]);

  // Exclusions du MOMENT : une note posée il y a dix secondes ou un « ne plus
  // me proposer » sortent le titre des rangées sans attendre la régénération.
  const exclude = new Set<string>();
  for (const r of ratings) exclude.add(canonicalKey(r.mediaType, r.tmdbId));
  for (const f of feedback) exclude.add(f.itemKey);

  let facets: Record<string, number> = {};
  try {
    facets = profileRow ? (JSON.parse(profileRow.facets) as Record<string, number>) : {};
  } catch {
    // Profil illisible : rangées sur profil vide, le rebuild réécrira.
  }
  const signalCount = profileRow?.signalCount ?? 0;
  const personalized = settings?.personalized ?? true;
  const state: RecoState = !tmdb || !personalized
    ? "disabled"
    : bootstrapping
      ? "warming"
      : signalCount < COLD_MIN_SIGNALS
        ? "cold"
        : signalCount < WARMING_MIN_SIGNALS
          ? "warming"
          : "ready";

  return {
    state,
    signalCount,
    lambda: (settings?.explorationBalance ?? 70) / 100,
    includeVigie: settings?.includeVigie ?? true,
    community: settings?.community ?? true,
    exclude,
    profile: { facets, signalCount },
    bootstrapping,
    tmdbConfigured: tmdb,
    personalized,
  };
}
