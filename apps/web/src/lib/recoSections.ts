/**
 * Les deux sections de la page Recommandations. « Affiner » (la pile de
 * swipe) y vit sous sa propre URL ; l'ancienne adresse `/swipe` y redirige,
 * pour les liens déjà partagés et les favoris du navigateur.
 */
export type RecoSection = "forYou" | "refine";

export const RECO_PATH = "/recommendations";
export const RECO_REFINE_PATH = "/recommendations/refine";

/** La section que montre une adresse — tout ce qui n'est pas « refine » est « Pour vous ». */
export function recoSectionOf(pathname: string): RecoSection {
  return pathname.replace(/\/+$/, "") === RECO_REFINE_PATH ? "refine" : "forYou";
}
