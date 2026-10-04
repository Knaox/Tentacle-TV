import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useJellyfinClient, useMediaItem, useTentacleConfig } from "@tentacle-tv/api-client";
import { parseYouTubeId } from "@tentacle-tv/shared";
import { trailerState } from "@tentacle-tv/tv-core";
import type { RootStackParamList } from "../../navigation/types";
import { bindTrailerFocus, useTrailerChrome, useTrailerReturn } from "../../platform/tvos/screens/trailer";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { TrailerView } from "../../redesign/screens/trailer/TrailerView";
import { TrailerWebView, TRAILER_WEBVIEW_SUPPORTED } from "../../screens/trailer/TrailerWebView";
import { detailBackdropUri } from "../detail/detailImages";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/**
 * La bande-annonce refondue (Apple TV) : `TrailerView` autour du lecteur
 * actuel — le flux résolu par le serveur (`TrailerWebView.tsx`), sourd à
 * la télécommande, qui dit chacune de ses issues : la première image
 * (« lecture »), la fin, ou l'échec (« indisponible » — jamais un chargement
 * sans fin). La croix Retour est le seul élément focalisable et prend le
 * focus d'entrée (seule action) ; Menu dépile l'écran (pile native), la fin
 * de la vidéo aussi.
 *
 * Un échec se dit en une phrase (« indisponible »), puis l'écran rend la
 * fiche de lui-même (`TRAILER_UNAVAILABLE_RETURN_MS`) — le focus y retrouve
 * « Bande-annonce » : jamais un écran sans issue, ni un lecteur figé.
 *
 * Le chrome s'estompe trois secondes après le début de la lecture, et le
 * moindre geste de la télécommande le rallume (`useTrailerChrome`) : la croix
 * garde le focus tout du long, elle ne peut donc pas en être le signal. Tout
 * geste compte, Retour excepté (il quitte) : un appui, ou un glisser sur le
 * pavé tactile — le seul signal qu'il émette ici, le focus n'ayant nulle part
 * où aller. Décidé par tv-core (`player/trailerChrome.ts`), posé par
 * l'applicateur `platform/tvos/screens/trailer.ts`.
 */

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
  const state = trailerState({ canPlay, failed, loaded });
  const isFocused = useIsFocused();
  const dimmed = useTrailerChrome(state === "playing", isFocused);

  const close = useCallback(() => navigation.goBack(), [navigation]);
  // Stables : le lecteur relance sa résolution quand ils changent.
  const onLoadEnd = useCallback(() => setLoaded(true), []);
  const onError = useCallback(() => setFailed(true), []);
  useTrailerReturn(state, isFocused, close);

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
    <FocusBindingProvider bind={bindTrailerFocus}>
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
