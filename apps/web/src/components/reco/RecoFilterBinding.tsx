import { useRecoFilterServerSync } from "../../hooks/useRecoFilter";

/**
 * Monte la synchronisation serveur du filtre de plateformes pour toute la
 * session authentifiée : le réglage du compte est adopté sans passer par la
 * page Recommandations (l'accueil filtre aussi), et un filtre retiré depuis
 * l'accueil part au serveur — la page Recommandations lit le même store.
 */
export function RecoFilterBinding() {
  useRecoFilterServerSync();
  return null;
}
