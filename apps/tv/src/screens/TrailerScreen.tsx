import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import type { RootStackParamList } from "../navigation/types";
import { useTVRemote } from "../components/focus/useTVRemote";
import { Focusable } from "../components/focus/Focusable";
import { CloseIcon } from "../components/icons/TVIcons";
import { parseYouTubeId } from "@tentacle-tv/shared";
import { TrailerWebView, TRAILER_WEBVIEW_SUPPORTED } from "./trailer/TrailerWebView";
import { Colors, Typography, Radius } from "../theme/colors";
import { Durations, Easings } from "../theme/motion";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/**
 * Lecture d'une bande-annonce YouTube dans l'app (plein écran).
 *
 * - L'embed passe par la page relais du serveur (`/yt-embed.html`) : une
 *   WebView Android n'envoie pas de Referer/origin valides à YouTube →
 *   erreur 153. Même remède que le DMG macOS.
 * - La WebView est NON focusable : sinon elle consomme les touches de la
 *   télécommande (dont BACK) et on reste bloqué. Le focus reste sur un
 *   bouton « Fermer » React Native (discret, s'estompe après 3 s) →
 *   BACK et SELECT fonctionnent toujours.
 */
export function TrailerScreen({ route, navigation }: Props) {
  const { url, name } = route.params;
  const { t, i18n } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useTVRemote({ onBack: () => navigation.goBack() });

  const ytId = parseYouTubeId(url);
  const lang = (i18n.language ?? "en").slice(0, 2);
  const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");
  // Android : embed YouTube via la page relais. tvOS : le variant .ios résout
  // un flux MP4 depuis ytId (la page relais est ignorée). Lecture possible dès
  // qu'on a un ytId + un serveur.
  const canPlay = TRAILER_WEBVIEW_SUPPORTED && !!ytId && !!serverUrl;
  const embedUrl = canPlay ? `${serverUrl}/yt-embed.html?v=${ytId}&hl=${lang}` : "";

  // Bouton Fermer : visible 3 s après le chargement, puis s'estompe (reste
  // focusable — un appui SELECT ferme, BACK aussi).
  const closeOpacity = useSharedValue(1);
  useEffect(() => {
    if (loaded) {
      closeOpacity.value = withDelay(3000, withTiming(0.15, { duration: Durations.slow, easing: Easings.out }));
    }
  }, [loaded, closeOpacity]);
  const closeStyle = useAnimatedStyle(() => ({ opacity: closeOpacity.value }));

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {canPlay && !failed ? (
        <TrailerWebView
          ytId={ytId as string}
          embedUri={embedUrl}
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
          onEnded={() => navigation.goBack()}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 80 }}>
          <Text style={{ color: Colors.textSecondary, ...Typography.body, textAlign: "center" }}>
            {t("trailerUnavailable", { defaultValue: "Bande-annonce indisponible" })}
          </Text>
        </View>
      )}

      {/* Bouton Fermer — garde le focus côté RN (la WebView est sourde) */}
      <Animated.View style={[{ position: "absolute", top: 24, left: 24 }, closeStyle]}>
        <Focusable
          variant="button"
          onPress={() => navigation.goBack()}
          hasTVPreferredFocus
          focusRadius={Radius.full}
          accessibilityLabel={t("close", { defaultValue: "Fermer" })}
          onFocus={() => { closeOpacity.value = withTiming(1, { duration: Durations.fast }); }}
        >
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 8,
            paddingHorizontal: 16, height: 44,
            borderRadius: Radius.full,
            backgroundColor: Colors.glassBgHeavy,
            borderWidth: 1, borderColor: Colors.glassBorder,
          }}>
            <CloseIcon size={16} color={Colors.textPrimary} />
            <Text style={{ color: Colors.textPrimary, ...Typography.buttonMedium }}>
              {t("close", { defaultValue: "Fermer" })}
            </Text>
          </View>
        </Focusable>
      </Animated.View>

      {/* Spinner pendant le chargement de l'embed */}
      {embedUrl && !loaded && !failed && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator size="large" color={Colors.accentPurple} />
          {!!name && (
            <Text style={{ color: Colors.textTertiary, ...Typography.caption, marginTop: 14 }} numberOfLines={1}>
              {name}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
