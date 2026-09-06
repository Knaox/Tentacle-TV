import { useRef } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MediaMissingView } from "@/components/player/MediaMissingView";
import { PlayerLoadingView } from "@/components/player/PlayerLoadingView";
import { useLocalSource } from "@/hooks/offline/useLocalSource";
import { probeNow, setManualOffline } from "@/offline/connectivityStore";
import type { OfflineLocalSource } from "@/offline/engineApi";
import { useConnectivity } from "@/offline/useConnectivity";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { LocalPlayerScreen } from "@/screens/LocalPlayerScreen";
import { PlayerScreen } from "@/screens/PlayerScreen";
import { PLAYER } from "@/theme";

/**
 * L'aiguillage de la lecture : un titre présent sur l'appareil se lit DEPUIS
 * l'appareil, même en ligne ; sinon le flux serveur. La source locale est
 * revérifiée sur le disque à chaque ouverture — le lecteur serveur émet des
 * requêtes dès son montage, on ne le monte donc pas avant d'avoir la réponse.
 *
 * La valeur vive ne décide que local / serveur : le lecteur reçoit une source
 * GELÉE pour la session (même fichier) — une source refetchée (position, vu)
 * changerait sa position de départ et rechargerait le média en pleine lecture.
 *
 * Hors ligne sans source locale, on le dit tout de suite : le lecteur serveur
 * attendrait vingt secondes une réponse qui ne viendra pas.
 */
export default function WatchRoute() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const { t } = useTranslation("downloads");
  const router = useRouter();
  const { localSource, waiting, refetch } = useLocalSource(itemId);
  const offline = useOfflineMode();
  const manual = useConnectivity().state === "offline-manual";
  const frozen = useRef<OfflineLocalSource | null>(null);
  if (localSource === null) frozen.current = null;
  else if (frozen.current === null || frozen.current.fileId !== localSource.fileId) frozen.current = localSource;

  if (waiting) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingView />
      </View>
    );
  }
  if (frozen.current !== null) {
    return <LocalPlayerScreen itemId={itemId} localSource={frozen.current} onMediaMissing={() => void refetch()} />;
  }
  if (offline) {
    // Hors ligne à la main, « Réessayer » n'aurait aucun effet : on propose
    // de repasser en ligne ; sinon une sonde forcée, et la source est relue.
    return (
      <MediaMissingView
        variant="notOnDevice"
        retryLabel={manual ? t("offlineGoOnline") : undefined}
        onRetry={manual ? () => setManualOffline(false) : () => { void probeNow(true); void refetch(); }}
        onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />
    );
  }
  return <PlayerScreen itemId={itemId} />;
}
