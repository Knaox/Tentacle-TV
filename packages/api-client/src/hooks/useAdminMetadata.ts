import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch, TentacleApiError } from "./usePreferences";
import { WATCH_PROVIDERS_KEY, type WatchProviderEntry } from "./useWatchProviders";

/** L'avancement du calcul des recommandations de tous les comptes (« fan-out »). */
export interface AdminRecoFanout {
  running: boolean;
  processed: number;
  total: number;
  /** Bilan de la dernière passe — absents d'un serveur d'avant 1.20.0. */
  failed?: number;
  finishedAt?: string | null;
}

/** Le contrat lu de GET /api/admin/metadata. */
export interface AdminMetadataStatus {
  tmdb: {
    configured: boolean;
    source: "env" | "db" | null;
    last4: string | null;
  };
  watchRegion?: string;
  fanout?: AdminRecoFanout;
}

/** Ce que PUT /api/admin/metadata accepte : un champ absent reste intact,
 *  une clé vide la retire. */
export interface AdminMetadataUpdate {
  tmdbApiKey?: string;
  watchRegion?: string;
}

export type TmdbKeyTestResult = "valid" | "invalid" | "unreachable";

/** Les refus que le serveur explique ; « unsupported » : serveur trop ancien
 *  pour la route (404) ; le reste est un échec sans détail. */
export type AdminMetadataErrorCode =
  | "tmdb-key-invalid"
  | "tmdb-unreachable"
  | "tmdb-key-missing"
  | "unsupported"
  | "failed";

/** Un pays où TMDB connaît des plateformes, et combien. */
export interface AdminProviderRegion {
  code: string;
  providers: number;
}

export const ADMIN_METADATA_KEY = ["admin", "metadata"] as const;
/** Racine DISTINCTE : les sondages de l'état ne rafraîchissent pas les pays. */
export const ADMIN_METADATA_REGIONS_KEY = ["admin", "metadata-regions"] as const;

/** Cadence du sondage pendant le calcul : un compte prend plusieurs dizaines
 *  de secondes, quatre suffisent à voir le compteur bouger. */
export const FANOUT_POLL_MS = 4000;

const KNOWN_ERRORS: ReadonlySet<string> = new Set(["tmdb-key-invalid", "tmdb-unreachable", "tmdb-key-missing"]);

/** Le code d'erreur d'un appel admin des métadonnées, lu dans le corps JSON
 *  que `tentacleApiFetch` garde comme message. */
export function adminMetadataErrorCode(err: unknown): AdminMetadataErrorCode {
  if (!(err instanceof TentacleApiError)) return "failed";
  if (err.status === 404) return "unsupported";
  try {
    const code = (JSON.parse(err.message) as { error?: unknown } | null)?.error;
    if (typeof code === "string" && KNOWN_ERRORS.has(code)) return code as AdminMetadataErrorCode;
  } catch {
    /* corps illisible : échec générique */
  }
  return "failed";
}

/** Sonder tant que le calcul tourne, se taire ensuite. */
export function fanoutRefetchInterval(status: AdminMetadataStatus | undefined): number | false {
  return status?.fanout?.running ? FANOUT_POLL_MS : false;
}

/**
 * L'état des métadonnées vu par un ADMIN (la route répond 403 aux autres,
 * d'où `enabled`) : la clé TMDB est-elle posée ? Sert aux bandeaux « ajoutez
 * votre clé » du web et du mobile — cinq minutes de fraîcheur, pas de relance
 * sur échec (un 403 ne se retente pas). `live` est la lecture de la page
 * Admin → Métadonnées : toujours fraîche, et sondée tant que le calcul des
 * recommandations tourne. Même clé de cache : une écriture de la page
 * efface aussitôt le bandeau.
 */
export function useAdminMetadataStatus(options: { enabled: boolean; live?: boolean }) {
  const live = options.live ?? false;
  return useQuery({
    queryKey: ADMIN_METADATA_KEY,
    queryFn: () => tentacleApiFetch<AdminMetadataStatus>("/api/admin/metadata"),
    enabled: options.enabled,
    staleTime: live ? 0 : 5 * 60_000,
    retry: live ? 1 : false,
    refetchOnWindowFocus: live,
    refetchInterval: live ? (query) => fanoutRefetchInterval(query.state.data) : false,
  });
}

/** PUT /api/admin/metadata — la clé y est validée auprès de TMDB avant d'être
 *  stockée (refus : `adminMetadataErrorCode`). */
export function useUpdateAdminMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (update: AdminMetadataUpdate) =>
      tentacleApiFetch<{ ok: true }>("/api/admin/metadata", { method: "PUT", body: JSON.stringify(update) }),
    onSuccess: (_data, update) => {
      void qc.invalidateQueries({ queryKey: ADMIN_METADATA_KEY });
      // Une première clé ouvre l'annuaire mondial : les pays deviennent connus.
      if (update.tmdbApiKey !== undefined) void qc.invalidateQueries({ queryKey: ADMIN_METADATA_REGIONS_KEY });
      // L'annuaire des plateformes du menu Filtres est celui de la région.
      if (update.watchRegion !== undefined) void qc.invalidateQueries({ queryKey: WATCH_PROVIDERS_KEY });
    },
  });
}

/** Le bouton « Tester » : la clé saisie, ou sans argument la clé en place.
 *  Rien n'est enregistré. */
export function useTestTmdbKey() {
  return useMutation({
    mutationFn: async (tmdbApiKey?: string) => {
      const body = JSON.stringify(tmdbApiKey ? { tmdbApiKey } : {});
      const res = await tentacleApiFetch<{ result: TmdbKeyTestResult }>("/api/admin/metadata/tmdb/test", {
        method: "POST",
        body,
      });
      return res.result;
    },
  });
}

/** Les pays que couvre TMDB. Vide sans clé, et face à un serveur d'avant la
 *  route : le sélecteur propose alors tous les pays. */
export function useAdminMetadataRegions(options: { enabled: boolean }) {
  return useQuery({
    queryKey: ADMIN_METADATA_REGIONS_KEY,
    queryFn: async () => {
      try {
        return (await tentacleApiFetch<{ regions: AdminProviderRegion[] }>("/api/admin/metadata/regions")).regions;
      } catch (err) {
        if (err instanceof TentacleApiError && err.status === 404) return [];
        throw err;
      }
    },
    enabled: options.enabled,
    staleTime: 60 * 60_000,
    retry: false,
  });
}

/** Les plateformes d'un pays, pour l'aperçu AVANT d'enregistrer ; l'aperçu
 *  précédent reste affiché pendant le chargement du suivant. */
export function useAdminRegionProviders(region: string | null) {
  return useQuery({
    queryKey: [...ADMIN_METADATA_REGIONS_KEY, region],
    queryFn: () =>
      tentacleApiFetch<{ region: string; providers: WatchProviderEntry[] }>(`/api/admin/metadata/regions/${region}`),
    enabled: !!region && /^[A-Z]{2}$/.test(region),
    staleTime: 60 * 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}
