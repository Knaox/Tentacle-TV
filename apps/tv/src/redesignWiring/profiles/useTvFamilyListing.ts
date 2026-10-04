import { useQuery } from "@tanstack/react-query";
import { fetchTvProfiles, useTentacleConfig } from "@tentacle-tv/api-client";
import type { TvProfilesDto } from "@tentacle-tv/shared";
import { tvSessionMode } from "@tentacle-tv/tv-core";
import { pairingCall } from "../../auth/profileOpening";

/** Les profils changent rarement : relus au plus toutes les cinq minutes. */
const LISTING_STALE_MS = 5 * 60_000;

/**
 * La famille de la TV pendant qu'un profil est ouvert (Apple TV, Famille) —
 * « Qui regarde ? » relu par le jeton de JUMELAGE, UNE lecture partagée :
 * l'empilement de « Changer de profil » (rail), et les droits du profil
 * ouvert tels que le serveur les dit maintenant (« peut demander » d'un
 * invité, que la garde de Vigie lit). Hors session de profil : null, aucune
 * requête.
 */
export function useTvFamilyListing(): TvProfilesDto | null {
  const { storage } = useTentacleConfig();
  const call = tvSessionMode(storage) === "profile" ? pairingCall(storage) : null;
  const { data } = useQuery({
    queryKey: ["tv-profiles", "open"],
    queryFn: ({ signal }) => fetchTvProfiles({ ...(call as NonNullable<typeof call>), signal }),
    enabled: call !== null,
    staleTime: LISTING_STALE_MS,
  });
  return call ? (data ?? null) : null;
}
