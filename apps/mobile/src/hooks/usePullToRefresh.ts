import { useCallback, useRef, useState } from "react";

/**
 * « Tirer pour rafraîchir » : l'anneau ne tourne que pour le GESTE de
 * l'utilisateur, du moment où il lâche jusqu'à la fin de `refresh`.
 *
 * Jamais un `refreshing` lu sur l'état d'une requête (`isFetching`,
 * `isRefetching`) : sur iOS, un anneau allumé par programme DÉCALE le contenu
 * de sa hauteur (≈ 60 pt) pour se montrer. Une relève automatique (poussée
 * du serveur, retour au premier plan, relève de repli toutes les minutes)
 * poussait ainsi la page vers le bas — et si elle se terminait pendant que
 * l'écran était caché (un autre onglet), le décalage restait : le héros de
 * l'accueil revenait plus bas que sa place, jusqu'au prochain défilement.
 * Le garde-fou `pullToRefreshGuard.test.ts` le tient.
 */
export function usePullToRefresh(refresh: () => unknown): { refreshing: boolean; onRefresh: () => void } {
  const [refreshing, setRefreshing] = useState(false);
  const busy = useRef(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const onRefresh = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    void Promise.resolve()
      .then(() => refreshRef.current())
      .catch(() => undefined)
      .finally(() => {
        busy.current = false;
        setRefreshing(false);
      });
  }, []);

  return { refreshing, onRefresh };
}
