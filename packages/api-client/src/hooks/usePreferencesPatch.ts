import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  HOME_LAYOUT_KEY,
  RECO_SETTINGS_KEY,
  fetchHomeLayout,
  fetchRecoSettings,
  putHomeLayout,
  putRecoSettings,
  type HomeLayoutData,
  type RecoSettingsData,
} from "./useHomeLayout";
import { invalidateRecoQueries } from "./useRecoPage";
import type { LibraryRef } from "../utils/homeRows";
import {
  applyHomeLayoutPatch,
  applyRecoSettingsPatch,
  pushHomeLayoutPatch,
  pushRecoSettingsPatch,
  type HomeLayoutPatch,
  type RecoSettingsPatch,
} from "../utils/preferencesPatch";

/**
 * Sauvegardes « lire avant d'écrire » des préférences du compte (cf.
 * utils/preferencesPatch pour la partie pure). Chaque mutation relit le
 * serveur DIRECTEMENT (jamais `qc.fetchQuery`, qui réécrirait le cache et
 * annulerait l'optimiste), n'applique que son changement et envoie le bloc
 * fusionné. Optimiste FONCTIONNEL sur le cache : un second tap se pose
 * par-dessus le premier. `scope` (v5) exécute les mutations d'un même bloc
 * en série — deux taps rapides font deux PUT dans l'ordre, chacun relisant le
 * serveur ; la TV (v4 au runtime) ignore l'option et n'appelle pas ces hooks.
 * Rollback et invalidation ne se font que par la DERNIÈRE mutation en vol :
 * c'est elle qui relit la vérité (tous les patches, plus les écritures des
 * autres appareils).
 */
export const HOME_LAYOUT_PATCH_KEY = ["home-layout", "patch"] as const;
export const RECO_SETTINGS_PATCH_KEY = ["reco-settings", "patch"] as const;
export const RECO_FILTER_PATCH_KEY = ["reco-settings", "filter"] as const;

/** Vrai quand aucune AUTRE mutation de cette clé n'est en vol ni en attente —
 *  la courante compte encore « pending » dans ses propres callbacks. */
function isLastPending(qc: QueryClient, mutationKey: readonly string[]): boolean {
  return qc.isMutating({ mutationKey: [...mutationKey] }) <= 1;
}

interface SaveHomeLayoutOptions {
  /** Les bibliothèques réelles : la copie fraîche est réconciliée AVANT le
   *  patch (cf. applyHomeLayoutPatch). À fournir dès qu'on édite les rangées. */
  libraries?: readonly LibraryRef[];
}

export function useSaveHomeLayoutPatch(options: SaveHomeLayoutOptions = {}) {
  const qc = useQueryClient();
  const { libraries } = options;
  return useMutation({
    mutationKey: HOME_LAYOUT_PATCH_KEY,
    scope: { id: "home-layout" },
    mutationFn: (patch: HomeLayoutPatch) =>
      pushHomeLayoutPatch(patch, libraries, { read: fetchHomeLayout, write: putHomeLayout }),
    onMutate: async (patch) => {
      // Un refetch en vol (diffusion en direct…) n'écrase pas l'optimiste.
      await qc.cancelQueries({ queryKey: HOME_LAYOUT_KEY });
      const previous = qc.getQueryData<HomeLayoutData>(HOME_LAYOUT_KEY);
      qc.setQueryData<HomeLayoutData>(HOME_LAYOUT_KEY, (cur) =>
        cur ? applyHomeLayoutPatch(cur, patch, libraries) : cur,
      );
      return { previous };
    },
    onError: (_e, _p, ctx) => {
      // Une autre sauvegarde attend son tour : c'est elle qui relira la vérité.
      if (ctx?.previous && isLastPending(qc, HOME_LAYOUT_PATCH_KEY)) {
        qc.setQueryData(HOME_LAYOUT_KEY, ctx.previous);
      }
    },
    onSettled: () => {
      if (isLastPending(qc, HOME_LAYOUT_PATCH_KEY)) void qc.invalidateQueries({ queryKey: HOME_LAYOUT_KEY });
    },
  });
}

function useRecoSettingsPatchMutation<V>(
  mutationKey: readonly string[],
  toPatch: (value: V) => RecoSettingsPatch,
  invalidatePage: boolean,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: [...mutationKey],
    scope: { id: "reco-settings" },
    mutationFn: (value: V) =>
      pushRecoSettingsPatch(toPatch(value), { read: fetchRecoSettings, write: putRecoSettings }),
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: RECO_SETTINGS_KEY });
      const previous = qc.getQueryData<RecoSettingsData>(RECO_SETTINGS_KEY);
      qc.setQueryData<RecoSettingsData>(RECO_SETTINGS_KEY, (cur) =>
        cur ? applyRecoSettingsPatch(cur, toPatch(value)) : cur,
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous && isLastPending(qc, mutationKey)) qc.setQueryData(RECO_SETTINGS_KEY, ctx.previous);
    },
    onSettled: () => {
      if (!isLastPending(qc, mutationKey)) return;
      void qc.invalidateQueries({ queryKey: RECO_SETTINGS_KEY });
      // Le curseur et les interrupteurs changent les rangées elles-mêmes ; le
      // filtre, lui, est déjà dans la clé de la page.
      if (invalidatePage) invalidateRecoQueries(qc);
    },
  });
}

/** Un ou plusieurs réglages de recommandation (interrupteurs, curseur). */
export function useSaveRecoSettingsPatch() {
  return useRecoSettingsPatchMutation<RecoSettingsPatch>(RECO_SETTINGS_PATCH_KEY, (patch) => patch, true);
}

/**
 * Le filtre de plateformes seul — relit le serveur (un autre appareil a pu
 * changer un interrupteur entre-temps). N'invalide PAS la page : sa clé
 * porte déjà le filtre, un refetch à chaque coche serait du bruit.
 */
export function useSaveRecoProviderFilter() {
  return useRecoSettingsPatchMutation<number[]>(RECO_FILTER_PATCH_KEY, (ids) => ({ providerFilter: ids }), false);
}
