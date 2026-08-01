export type UpdatePhase = "idle" | "available" | "downloading" | "installing" | "restarting";

export interface UpdateInfo {
  available: boolean;
  phase: UpdatePhase;
  version?: string;
  notes?: string;
  downloading: boolean;
  progress: number;
  /**
   * Le téléchargement est en cours mais son avancement est INCONNU — la barre
   * doit alors balayer au lieu de se remplir.
   *
   * C'est le cas du Microsoft Store : il télécharge et installe lui-même, et
   * n'expose son avancement qu'à un délégué WinRT — un objet COM à fabriquer à
   * la main, dont l'`Invoke` est appelé depuis un fil de la réserve, là où un
   * pont FFI ne peut pas rappeler du JavaScript. La coquille annonçait donc 0 %
   * puis 100 %, et la barre restait plantée à zéro pendant toute la durée du
   * téléchargement. Une barre indéterminée dit la vérité : il se passe quelque
   * chose, on ne sait pas où ça en est.
   */
  indeterminate: boolean;
  error: string | null;
  /** Build Mac App Store : le bouton ouvre l'App Store au lieu d'installer. */
  isStoreUpdate: boolean;
  /** L'App Store a été ouvert (hint « cliquez sur Mettre à jour » affiché). */
  storeOpened: boolean;
  storeUrl?: string;
}

export const defaultUpdateInfo: UpdateInfo = {
  available: false,
  phase: "idle",
  downloading: false,
  progress: 0,
  indeterminate: false,
  error: null,
  isStoreUpdate: false,
  storeOpened: false,
};
