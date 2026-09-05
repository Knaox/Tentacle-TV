import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";
import { invalidateRecoQueries, normalizeProviderFilter } from "./useRecoPage";

export type HeroMode = "resume" | "random" | "reco" | "fixed";
export type CardDensity = "compact" | "normal" | "large";

export interface HomeRowDescriptor {
  key: string;
  enabled: boolean;
}

export interface HomeLayoutData {
  heroMode: HeroMode;
  heroFixedItemId: string | null;
  /** Ordonné : la position dans le tableau EST l'ordre d'affichage. */
  rows: HomeRowDescriptor[];
  cardDensity: CardDensity;
  /** false : rien d'enregistré, ce sont les défauts serveur — le client peut
   *  alors ancrer les bibliothèques dans l'ordre du défaut. Drapeau de
   *  LECTURE seulement, jamais renvoyé au serveur. */
  stored?: boolean;
  /** Le catalogue des rangées statiques que CE serveur sait afficher, dans
   *  l'ordre par défaut avec leur activation par défaut (sans clé TMDB, les
   *  rangées personnalisées n'y sont pas). LECTURE seulement : l'accueil ne
   *  rend et l'éditeur ne propose que ses clés (cf. utils/homeRows). Absent
   *  chez un vieux serveur : tout s'affiche. */
  catalog?: HomeRowDescriptor[];
}

export interface RecoSettingsData {
  personalized: boolean;
  includeVigie: boolean;
  community: boolean;
  shareHistory: boolean;
  explorationBalance: number;
  /** Filtre de plateformes de la page Recommandations (ids TMDB principaux,
   *  triés) — suit le compte ; le serveur précalcule la page de ce filtre. */
  providerFilter: number[];
}

/** Le corps d'un PUT : la mise en page sans ses données de lecture. */
export type HomeLayoutInput = Omit<HomeLayoutData, "stored" | "catalog">;

interface StoredResponse<T> {
  stored: boolean;
  layout?: T;
  settings?: T;
  catalog?: HomeRowDescriptor[];
}

export const HOME_LAYOUT_KEY = ["home-layout"] as const;
export const RECO_SETTINGS_KEY = ["reco-settings"] as const;
/** Clés des sauvegardes de bloc entier — préfixe `home-layout` / `reco-settings`
 *  partagé avec les sauvegardes lire-avant-d'écrire (cf. usePreferencesPatch),
 *  pour qu'une diffusion en direct sache qu'une écriture locale est en vol. */
export const HOME_LAYOUT_SAVE_KEY = ["home-layout", "save"] as const;
export const RECO_SETTINGS_SAVE_KEY = ["reco-settings", "save"] as const;

/** La mise en page du compte, telle que le serveur la sert (défauts compris). */
export async function fetchHomeLayout(): Promise<HomeLayoutData> {
  const res = await tentacleApiFetch<StoredResponse<HomeLayoutData>>("/api/preferences/home-layout");
  return { ...res.layout!, stored: res.stored, catalog: res.catalog };
}

export function putHomeLayout(body: HomeLayoutInput): Promise<{ ok: boolean }> {
  return tentacleApiFetch<{ ok: boolean }>("/api/preferences/home-layout", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function putRecoSettings(body: RecoSettingsData): Promise<{ ok: boolean }> {
  return tentacleApiFetch<{ ok: boolean }>("/api/preferences/reco", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * Mise en page de l'accueil — source de vérité BACKEND (sync multi-appareils),
 * le cache TanStack n'est qu'un miroir optimiste. Le serveur rend toujours des
 * défauts (`stored: false`) : un compte sans réglage voit l'accueil historique.
 */
export function useHomeLayout() {
  return useQuery({
    queryKey: HOME_LAYOUT_KEY,
    queryFn: fetchHomeLayout,
    staleTime: 60_000,
  });
}

export function useSaveHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: HOME_LAYOUT_SAVE_KEY,
    mutationFn: (layout: HomeLayoutData) => {
      // `stored` et `catalog` sont des données de lecture : elles ne
      // repartent jamais au serveur.
      const body = { ...layout };
      delete body.stored;
      delete body.catalog;
      return putHomeLayout(body);
    },
    onMutate: async (layout) => {
      await qc.cancelQueries({ queryKey: ["home-layout"] });
      const previous = qc.getQueryData<HomeLayoutData>(["home-layout"]);
      qc.setQueryData(["home-layout"], layout);
      return { previous };
    },
    onError: (_e, _l, ctx) => {
      if (ctx?.previous) qc.setQueryData(["home-layout"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["home-layout"] });
    },
  });
}

/** Un vieux serveur ne renvoie pas `providerFilter` : tableau vide. */
export async function fetchRecoSettings(): Promise<RecoSettingsData> {
  const res = await tentacleApiFetch<StoredResponse<RecoSettingsData>>("/api/preferences/reco");
  const settings = res.settings!;
  return { ...settings, providerFilter: normalizeProviderFilter(settings.providerFilter) };
}

export function useRecoSettings() {
  return useQuery({
    queryKey: RECO_SETTINGS_KEY,
    queryFn: fetchRecoSettings,
    staleTime: 60_000,
  });
}

// Le filtre de plateformes seul vit dans usePreferencesPatch (lire avant
// d'écrire) : `useSaveRecoProviderFilter`.

export function useSaveRecoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: RECO_SETTINGS_SAVE_KEY,
    mutationFn: (settings: RecoSettingsData) => putRecoSettings(settings),
    onMutate: async (settings) => {
      await qc.cancelQueries({ queryKey: ["reco-settings"] });
      const previous = qc.getQueryData<RecoSettingsData>(["reco-settings"]);
      qc.setQueryData(["reco-settings"], settings);
      return { previous };
    },
    onError: (_e, _s, ctx) => {
      if (ctx?.previous) qc.setQueryData(["reco-settings"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["reco-settings"] });
      // Le curseur λ et les interrupteurs changent les rangées elles-mêmes.
      invalidateRecoQueries(qc);
    },
  });
}

/** Remise à zéro du profil de goût (confirmation explicite côté UI). */
export function useResetTasteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      tentacleApiFetch<{ ok: boolean }>("/api/reco/profile/reset", { method: "POST" }),
    onSettled: () => invalidateRecoQueries(qc),
  });
}
