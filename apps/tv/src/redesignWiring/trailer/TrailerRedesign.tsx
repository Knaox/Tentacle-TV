import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJellyfinClient, useMediaItem, useTentacleConfig } from "@tentacle-tv/api-client";
import { parseYouTubeId } from "@tentacle-tv/shared";
import type { RootStackParamList } from "../../navigation/types";
import { FocusBindingProvider, type FocusBinding } from "../../redesign/focus/focusBinding";
import { TrailerView } from "../../redesign/screens/trailer/TrailerView";
import { TrailerWebView, TRAILER_WEBVIEW_SUPPORTED } from "../../screens/trailer/TrailerWebView";
import { detailBackdropUri } from "../detail/detailImages";
import { useRemoteEvents } from "../remote/remoteEvents";
import { useIdleChrome } from "./useIdleChrome";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/**
 * La bande-annonce refondue (Apple TV) : `TrailerView` autour du lecteur
 * actuel — le flux résolu par le serveur (`TrailerWebView.ios.tsx`), sourd à
 * la télécommande, qui dit chacune de ses issues : la première image
 * (« lecture »), la fin, ou l'échec (« indisponible » — jamais un chargement
 * sans fin). « Fermer » est le seul élément focalisable et prend le focus
 * d'entrée ; Menu dépile l'écran (pile native), la fin de la vidéo aussi.
 *
 * Le chrome s'estompe trois secondes après le début de la lecture, et le
 * moindre geste de la télécommande le rallume (`useIdleChrome`) : « Fermer »
 * garde le focus tout du long, il ne peut donc pas en être le signal. Tout
 * geste compte (`useRemoteEvents`) : un appui, ou un glisser sur le pavé
 * tactile — le seul signal qu'il émette ici, le focus n'ayant nulle part où
 * aller.
 */

const CLOSE_KEY = "trailer:close";
const ENTRY: FocusBinding = { native: { hasTVPreferredFocus: true } };
const bindClose = (focusKey: string) => (focusKey === CLOSE_KEY ? ENTRY : undefined);

export function TrailerRedesign({ route, navigation }: Props) {
  const { url, name, itemId } = route.params;
  const { i18n } = useTranslation();
  const { storage } = useTentacleConfig();
  const client = useJellyfinClient();
  // L'œuvre, déjà en cache (la fiche l'a lue) : son image pendant le chargement.
  const { data: item } = useMediaItem(itemId);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const ytId = parseYouTubeId(url);
  const lang = (i18n.language ?? "en").slice(0, 2);
  const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
  // Sans identifiant YouTube ni serveur, rien à lire : l'écran le dit — et,
  // pour une vidéo hors YouTube, que c'est le téléviseur qui ne sait pas la lire.
  const canPlay = TRAILER_WEBVIEW_SUPPORTED && !!ytId && !!serverUrl;
  const state = !canPlay || failed ? "unavailable" : loaded ? "playing" : "loading";
  const { dimmed, wake } = useIdleChrome(state === "playing");

  const isFocused = useIsFocused();
  const close = useCallback(() => navigation.goBack(), [navigation]);
  // Stables : le lecteur relance sa résolution quand ils changent.
  const onLoadEnd = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setFailed(true), []);
  useRemoteEvents(wake, isFocused);

  const video = canPlay && ytId && !failed ? (
    <TrailerWebView
      ytId={ytId}
      embedUri={`${serverUrl}/yt-embed.html?v=${ytId}&hl=${lang}`}
      onLoadEnd={onLoadEnd}
      onError={onError}
      onEnded={close}
      onWaitingChange={setWaiting}
    />
  ) : undefined;

  return (
    <FocusBindingProvider bind={bindClose}>
      <TrailerView
        state={state}
        title={name || item?.Name || ""}
        backdropUri={item ? detailBackdropUri(client, item) : undefined}
        video={video}
        chromeDimmed={dimmed}
        waiting={waiting}
        unavailableReason={ytId ? "youtube" : "unsupported"}
        onClose={close}
      />
    </FocusBindingProvider>
  );
}
