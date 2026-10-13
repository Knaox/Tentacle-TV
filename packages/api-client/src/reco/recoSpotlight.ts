import type { RecoPage } from "../hooks/useRecoPage";
import type { RecoRowItem } from "../hooks/recoTypes";

/** Les alternatives montrées à côté de la une — assez pour choisir, pas plus. */
export const RECO_SPOTLIGHT_ALTERNATIVES = 4;

export interface RecoSpotlight {
  /** LE titre de ce soir : le « à la une » du serveur, sinon la tête de « Pour vous ». */
  featured: RecoRowItem | undefined;
  /** Les meilleures suivantes de « Pour vous », pour qui hésite. */
  alternatives: RecoRowItem[];
}

const hasWideVisual = (item: RecoRowItem) => !!(item.backdropPath || item.jellyfinItemId);

/**
 * Pur : la une d'une page. Le serveur la désigne (`featured`, son meilleur
 * pari) ; un serveur d'avant n'en sert pas — la tête de « Pour vous » ayant un
 * visuel large fait foi (la rangée est classée). Les alternatives suivent dans
 * l'ordre de « Pour vous », sans la une : l'ordre du moteur, jamais un tirage.
 */
export function recoSpotlightOf(page: RecoPage | undefined, max = RECO_SPOTLIGHT_ALTERNATIVES): RecoSpotlight {
  const forYou = page?.rows.find((row) => row.key === "forYou")?.items ?? [];
  const featured = page?.featured?.item ?? forYou.find(hasWideVisual) ?? forYou[0];
  const alternatives = forYou.filter((item) => item.key !== featured?.key && hasWideVisual(item)).slice(0, max);
  return { featured, alternatives };
}
