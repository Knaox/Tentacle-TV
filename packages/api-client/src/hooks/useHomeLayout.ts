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

interface StoredResponse<T> {
  stored: boolean;
  layout?: T;
  settings?: T;
}

/**
 * Mise en page de l'accueil — source de vérité BACKEND (sync multi-appareils),
 * le cache TanStack n'est qu'un miroir optimiste. Le serveur rend toujours des
 * défauts (`stored: false`) : un compte sans réglage voit l'accueil historique.
 */
export function useHomeLayout() {
  return useQuery({
    queryKey: ["home-layout"],
    queryFn: async () => {
      const res = await tentacleApiFetch<StoredResponse<HomeLayoutData>>(
        "/api/preferences/home-layout"
      );
      return { ...res.layout!, stored: res.stored };
    },
    staleTime: 60_000,
  });
}

export function useSaveHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: HomeLayoutData) => {
      // `stored` est un drapeau de lecture : il ne repart jamais au serveur.
      const body = { ...layout };
      delete body.stored;
      return tentacleApiFetch<{ ok: boolean }>("/api/preferences/home-layout", {
        method: "PUT",
        body: JSON.stringify(body),
      });
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
async function fetchRecoSettings(): Promise<RecoSettingsData> {
  const res = await tentacleApiFetch<StoredResponse<RecoSettingsData>>("/api/preferences/reco");
  const settings = res.settings!;
  return { ...settings, providerFilter: normalizeProviderFilter(settings.providerFilter) };
}

export function useRecoSettings() {
  return useQuery({
    queryKey: ["reco-settings"],
    queryFn: fetchRecoSettings,
    staleTime: 60_000,
  });
}

/**
 * Le filtre de plateformes seul — le PUT remplace le bloc entier, donc les
 * réglages courants sont relus (cache, sinon serveur). Optimiste sur
 * ["reco-settings"] ; n'invalide PAS la page : sa clé porte déjà le filtre,
 * un refetch à chaque coche serait du bruit.
 */
export function useSaveRecoProviderFilter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerFilter: number[]) => {
      const current =
        qc.getQueryData<RecoSettingsData>(["reco-settings"]) ??
        (await qc.fetchQuery({ queryKey: ["reco-settings"], queryFn: fetchRecoSettings }));
      return tentacleApiFetch<{ ok: boolean }>("/api/preferences/reco", {
        method: "PUT",
        body: JSON.stringify({ ...current, providerFilter: normalizeProviderFilter(providerFilter) }),
      });
    },
    onMutate: async (providerFilter) => {
      await qc.cancelQueries({ queryKey: ["reco-settings"] });
      const previous = qc.getQueryData<RecoSettingsData>(["reco-settings"]);
      if (previous) {
        qc.setQueryData(["reco-settings"], { ...previous, providerFilter: normalizeProviderFilter(providerFilter) });
      }
      return { previous };
    },
    onError: (_e, _s, ctx) => {
      if (ctx?.previous) qc.setQueryData(["reco-settings"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["reco-settings"] });
    },
  });
}

export function useSaveRecoSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: RecoSettingsData) =>
      tentacleApiFetch<{ ok: boolean }>("/api/preferences/reco", {
        method: "PUT",
        body: JSON.stringify(settings),
      }),
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
