import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tentacleApiFetch } from "./usePreferences";
import { dropRecoItemEverywhere, invalidateRecoQueries } from "./useRecoPage";

export type RatingMediaType = "movie" | "series" | "episode";

/** Identité d'un titre notable — la clé canonique (mediaType, tmdbId). */
export interface RatingIdentity {
  mediaType: RatingMediaType;
  tmdbId: number;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface UserRatingEntry {
  id: string;
  mediaType: RatingMediaType;
  tmdbId: number;
  jellyfinItemId: string | null;
  seasonNumber: number;
  episodeNumber: number;
  score: number; // 1..10 (1 = une demi-étoile)
  syncStatus: "pending" | "synced" | "failed" | "disabled" | "delete_pending";
  updatedAt: string;
}

export interface RateItemInput extends RatingIdentity {
  score: number;
  jellyfinItemId?: string | null;
}

/** Clé de correspondance locale d'une note (saison/épisode normalisés à 0). */
export function ratingKey(identity: RatingIdentity): string {
  return `${identity.mediaType}:${identity.tmdbId}:${identity.seasonNumber ?? 0}:${identity.episodeNumber ?? 0}`;
}

/** Clé canonique des rangées de reco (« movie:603 » / « tv:1399 ») — null
 *  pour un épisode, qui n'apparaît jamais dans une rangée. */
function recoKeyOf(mediaType: RatingMediaType, tmdbId: number): string | null {
  if (mediaType === "movie") return `movie:${tmdbId}`;
  if (mediaType === "series") return `tv:${tmdbId}`;
  return null;
}

function identityQuery(identity: RatingIdentity): string {
  const q = new URLSearchParams({
    mediaType: identity.mediaType,
    tmdbId: String(identity.tmdbId),
    seasonNumber: String(identity.seasonNumber ?? 0),
    episodeNumber: String(identity.episodeNumber ?? 0),
  });
  return q.toString();
}

// Même garde que les préférences : pas de session, pas de requête. Sur les
// plateformes natives (localStorage absent), le jeton vient de
// setPreferencesToken et la garde s'efface.
function hasSession(): boolean {
  if (typeof localStorage === "undefined") return true;
  return !!(localStorage.getItem("tentacle_token") || localStorage.getItem("tentacle_user"));
}

/**
 * TOUTES les notes du compte, en une seule requête et un seul cache : les
 * étoiles d'une fiche ou d'une carte se servent dans cette liste (au plus un
 * millier de lignes) plutôt que d'ouvrir une requête par titre affiché.
 */
export function useMyRatings() {
  return useQuery({
    queryKey: ["ratings"],
    queryFn: () => tentacleApiFetch<UserRatingEntry[]>("/api/ratings"),
    staleTime: 60_000,
    enabled: hasSession(),
  });
}

/** La note du compte pour UN titre (null si non noté, undefined en chargement). */
export function useItemRating(identity: RatingIdentity | null): UserRatingEntry | null | undefined {
  const { data, isPending } = useMyRatings();
  if (!identity) return null;
  if (isPending) return undefined;
  const key = ratingKey(identity);
  return data?.find((r) => ratingKey(r) === key) ?? null;
}

/** Pose ou remplace une note — écriture optimiste dans la liste `["ratings"]`. */
export function useRateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RateItemInput) =>
      tentacleApiFetch<UserRatingEntry>("/api/ratings", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["ratings"] });
      const previous = qc.getQueryData<UserRatingEntry[]>(["ratings"]);
      const key = ratingKey(input);
      const optimistic: UserRatingEntry = {
        id: `optimistic-${key}`,
        mediaType: input.mediaType,
        tmdbId: input.tmdbId,
        jellyfinItemId: input.jellyfinItemId ?? null,
        seasonNumber: input.seasonNumber ?? 0,
        episodeNumber: input.episodeNumber ?? 0,
        score: input.score,
        syncStatus: "pending",
        updatedAt: new Date().toISOString(),
      };
      qc.setQueryData<UserRatingEntry[]>(["ratings"], (old) => {
        const rest = (old ?? []).filter((r) => ratingKey(r) !== key);
        return [optimistic, ...rest];
      });
      // Un titre noté est EXCLU des recommandations : il sort des rangées
      // chargées tout de suite (même retrait optimiste que « ne plus me
      // proposer ») au lieu d'y traîner jusqu'au prochain refetch.
      const rowKey = recoKeyOf(input.mediaType, input.tmdbId);
      if (rowKey) await dropRecoItemEverywhere(qc, rowKey);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(["ratings"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["ratings"] });
      // Resynchronise la page avec les exclusions serveur (et remet l'item si
      // la note n'a finalement pas été enregistrée).
      invalidateRecoQueries(qc);
    },
  });
}

/** Retire une note — retrait optimiste de la liste `["ratings"]`. */
export function useDeleteRating() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (identity: RatingIdentity) =>
      tentacleApiFetch<{ ok: boolean }>(`/api/ratings/item?${identityQuery(identity)}`, {
        method: "DELETE",
      }),
    onMutate: async (identity) => {
      await qc.cancelQueries({ queryKey: ["ratings"] });
      const previous = qc.getQueryData<UserRatingEntry[]>(["ratings"]);
      const key = ratingKey(identity);
      qc.setQueryData<UserRatingEntry[]>(["ratings"], (old) =>
        (old ?? []).filter((r) => ratingKey(r) !== key)
      );
      return { previous };
    },
    onError: (_err, _identity, ctx) => {
      if (ctx?.previous) qc.setQueryData(["ratings"], ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["ratings"] });
      // Note retirée : le titre redevient recommandable — la page se ressert.
      invalidateRecoQueries(qc);
    },
  });
}
