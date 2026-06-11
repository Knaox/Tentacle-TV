import { useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { useTranslation } from "react-i18next";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { useTVRemote } from "../components/focus/useTVRemote";
import { parseYouTubeId } from "@tentacle-tv/shared";
import { Colors, Typography } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Trailer">;

/**
 * Lecture d'une bande-annonce YouTube dans l'app (plein écran) — même
 * comportement que le desktop : embed `youtube-nocookie` avec autoplay,
 * sous-titres/interface dans la langue du profil, BACK télécommande pour
 * fermer.
 */
export function TrailerScreen({ route, navigation }: Props) {
  const { url, name } = route.params;
  const { t, i18n } = useTranslation("common");
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useTVRemote({ onBack: () => navigation.goBack() });

  const ytId = parseYouTubeId(url);
  const lang = (i18n.language ?? "en").slice(0, 2);
  const embedUrl = ytId
    ? `https://www.youtube-nocookie.com/embed/${ytId}?rel=0&autoplay=1&hl=${lang}&cc_lang_pref=${lang}`
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {embedUrl && !failed ? (
        <WebView
          source={{ uri: embedUrl }}
          style={{ flex: 1, backgroundColor: "#000" }}
          // Autoplay sans interaction utilisateur (Android WebView)
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          javaScriptEnabled
          domStorageEnabled
          onLoadEnd={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 80 }}>
          <Text style={{ color: Colors.textSecondary, ...Typography.body, textAlign: "center" }}>
            {t("trailerUnavailable", { defaultValue: "Bande-annonce indisponible" })}
          </Text>
        </View>
      )}

      {/* Spinner pendant le chargement de l'embed */}
      {embedUrl && !loaded && !failed && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
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
