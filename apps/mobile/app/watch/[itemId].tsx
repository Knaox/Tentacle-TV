import { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMediaItem } from "@tentacle-tv/api-client";
import { describeProblem, type ProblemActionKey, type ProblemCause } from "@tentacle-tv/shared";
import { PlayerLoadingScreen } from "@/components/player/loading/PlayerLoadingScreen";
import { PlaybackProblemView } from "@/components/problems/PlaybackProblemView";
import { useLocalSource } from "@/hooks/offline/useLocalSource";
import { backOrHome } from "@/utils/backOrHome";
import { probeNow, setManualOffline, type OfflineReason } from "@/offline/connectivityStore";
import type { OfflineLocalSource } from "@/offline/engineApi";
import { useConnectivity } from "@/offline/useConnectivity";
import { useHasLocalContent, useOfflineMode } from "@/offline/useOfflineMode";
import { LocalPlayerScreen } from "@/screens/LocalPlayerScreen";
import { PlayerScreen } from "@/screens/PlayerScreen";
import { PLAYER } from "@/theme";

/** Pourquoi l'app est hors ligne, en cause du modèle d'erreur. */
function offlineCause(manual: boolean, reason: OfflineReason): ProblemCause {
  if (manual) return "offlineMode";
  if (reason === "network") return "deviceOffline";
  if (reason === "timeout") return "serverTimeout";
  if (reason === "jellyfin") return "jellyfinUnreachable";
  return "serverUnreachable";
}

/**
 * L'aiguillage de la lecture : un titre présent sur l'appareil se lit DEPUIS
 * l'appareil, même en ligne ; sinon le flux serveur. La source locale est
 * revérifiée sur le disque à chaque ouverture — le lecteur serveur émet des
 * requêtes dès son montage, on ne le monte donc pas avant d'avoir la réponse.
 * `source=server` contourne le fichier local (« Regarder en ligne », quand
 * l'appareil ne sait pas le lire).
 *
 * La valeur vive ne décide que local / serveur : le lecteur reçoit une source
 * GELÉE pour la session (même fichier) — une source refetchée (position, vu)
 * changerait sa position de départ et rechargerait le média en pleine lecture.
 *
 * Hors ligne sans source locale, AVANT d'ouvrir le lecteur, on le dit tout de
 * suite, avec la cause (le réseau de l'appareil, le serveur, Jellyfin, le mode
 * hors ligne) : le lecteur serveur attendrait vingt secondes une réponse qui ne
 * viendra pas. Une lecture déjà ouverte, elle, n'est jamais démontée par une
 * bascule hors ligne : un flux direct vers Jellyfin survit au serveur Tentacle
 * muet, et si le flux cale, le lecteur le dit lui-même (cause, reprise).
 */
export default function WatchRoute() {
  // `version` : la version choisie sur la fiche (`VERSION_QUERY_PARAM`), sinon celle de Jellyfin.
  const { itemId, version, source } = useLocalSearchParams<{ itemId: string; version?: string; source?: string }>();
  const router = useRouter();
  const { localSource, waiting, refetch } = useLocalSource(itemId);
  const offline = useOfflineMode();
  const { state, reason } = useConnectivity();
  const manual = state === "offline-manual";
  const hasLocalContent = useHasLocalContent() === true;
  const forceServer = source === "server";
  const frozen = useRef<OfflineLocalSource | null>(null);
  if (localSource === null || forceServer) frozen.current = null;
  else if (frozen.current === null || frozen.current.fileId !== localSource.fileId) frozen.current = localSource;
  // Le titre, pour habiller l'écran de chargement dès l'ouverture — la même
  // requête (et le même cache) que le lecteur ; rien hors ligne.
  const { data: item } = useMediaItem(itemId, { enabled: !offline });
  // Le lecteur serveur est ouvert : il garde la main sur ses propres échecs.
  const streamed = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const back = useCallback(() => backOrHome(router), [router]);

  const offlineModel = useMemo(() => describeProblem({
    cause: offlineCause(manual, reason),
    context: "playbackStart",
    availability: { hasOfflineLibrary: hasLocalContent },
  }), [manual, reason, hasLocalContent]);

  const onOfflineAction = useCallback((key: ProblemActionKey) => {
    if (key === "goOnline") setManualOffline(false);
    else if (key === "offlineLibrary") router.replace("/on-device");
    else if (key === "retry") {
      // Une sonde forcée ; la source est relue. En ligne, le lecteur reprend seul.
      setRetrying(true);
      void Promise.all([probeNow(true), refetch()]).finally(() => setRetrying(false));
    } else back();
  }, [router, refetch, back]);

  if (waiting && !forceServer) {
    return (
      <View style={{ flex: 1, backgroundColor: PLAYER.bg }}>
        <PlayerLoadingScreen item={item} onCancel={back} />
      </View>
    );
  }
  if (frozen.current !== null) {
    return <LocalPlayerScreen itemId={itemId} localSource={frozen.current} />;
  }
  if (offline && !streamed.current) {
    return (
      <PlaybackProblemView
        model={offlineModel}
        item={item}
        onAction={onOfflineAction}
        onBack={back}
        busy={retrying ? "retry" : null}
      />
    );
  }
  streamed.current = true;
  return <PlayerScreen itemId={itemId} version={version} />;
}
