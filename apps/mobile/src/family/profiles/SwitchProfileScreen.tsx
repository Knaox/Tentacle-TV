import { useCallback, useEffect } from "react";
import { useRouter } from "expo-router";
import type { PickedProfileDto } from "@tentacle-tv/shared";
import { useCommitPick } from "./useCommitPick";
import { usePickerListing } from "./usePickerListing";
import { WhoIsWatchingView } from "./view/WhoIsWatchingView";

/**
 * « Changer de profil » (Réglages › Compte → `/who-is-watching`) : le même
 * « Qui regarde ? », avec « Annuler » et le profil en cours. Le profil choisi
 * devient le choix retenu de l'appareil. Face à un serveur qui ne déclare pas
 * `family.mobileProfiles` (lien resté, serveur rétrogradé), l'écran se referme
 * sans rien demander.
 */
export function SwitchProfileScreen() {
  const router = useRouter();
  const listing = usePickerListing();
  const commit = useCommitPick();
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)" as never);
  }, [router]);

  const absent = listing.configSettled && !listing.capable;
  useEffect(() => {
    if (absent) close();
  }, [absent, close]);

  const { refetch } = listing;
  const onStale = useCallback(() => void refetch(), [refetch]);
  const onPicked = useCallback((picked: PickedProfileDto) => {
    const result = commit(picked);
    if (result === "stay") close();
    else if (result === "switched") router.replace("/(tabs)" as never);
  }, [commit, close, router]);

  return <WhoIsWatchingView listing={listing.data} mode="switch" onPicked={onPicked} onStale={onStale} onCancel={close} />;
}
