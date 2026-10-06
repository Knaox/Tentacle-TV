import { useSegments } from "expo-router";
import { useJellyfinOutage, veilYieldsToPlayer } from "@tentacle-tv/api-client";
import { isDeviceSideReason } from "@tentacle-tv/offline-core";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineSwitchBanner } from "./OfflineSwitchBanner";
import { useConnectivity } from "./useConnectivity";
import { useHasLocalContent } from "./useOfflineMode";
import { useOfflineVeilActions } from "./useOfflineVeilActions";

/**
 * Ce que l'application montre quand elle bascule hors ligne.
 *
 * Trois cas, exclusifs par construction : avec des titres, un bandeau qui
 * explique la bascule au-dessus du catalogue local ; sans titre et le SERVEUR
 * en cause, le voile plein écran (il n'y a rien d'autre à faire) ; sans titre
 * et la CONNEXION en cause, le catalogue local vide, qui le dit — le voile
 * accuserait le serveur alors que c'est l'appareil qui n'a plus de réseau.
 * Nécessite AppProviders.
 */
export function OfflineOverlays() {
  const { state, reason } = useConnectivity();
  const hasLocalContent = useHasLocalContent();
  const { isChecking, retry, handleLogout, handleChangeServer, goOffline } = useOfflineVeilActions();
  // Jellyfin seul en panne, dite par le serveur, lecteur ouvert : l'image joue
  // encore sur sa réserve — le message temporaire du lecteur dit la cause.
  const [root] = useSegments();
  const { phase } = useJellyfinOutage();
  const yields = veilYieldsToPlayer({ playerOpen: root === "watch", reason, phase });

  return (
    <>
      <OfflineBanner
        visible={state === "offline-auto" && hasLocalContent === false && !isDeviceSideReason(reason) && !yields}
        isChecking={isChecking}
        onRetry={retry}
        onLogout={handleLogout}
        onChangeServer={handleChangeServer}
        onGoOffline={goOffline}
      />
      <OfflineSwitchBanner />
    </>
  );
}
