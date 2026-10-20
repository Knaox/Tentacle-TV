import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { Cast } from "lucide-react-native";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { PLAYER, TABLET_MIN_WIDTH } from "@/theme";
import type { CastSession } from "../../player/cast/useCastSession";
import { loadingArt } from "./loading/loadingArt";
import { CenterControls } from "./CenterControls";
import { PlayerSeekBar } from "./PlayerSeekBar";
import { PlayerTopBar } from "./PlayerTopBar";

interface Props {
  cast: CastSession;
  item: MediaItem | undefined;
  mediaSourceId?: string;
  onBack: () => void;
}

/**
 * L'écran du lecteur pendant une diffusion : le téléphone devient la
 * télécommande de la TV — le fond du titre, « Lecture sur … », la barre, les
 * sauts, et « Arrêter la diffusion » qui rend la main au téléphone. Toujours
 * à l'écran (rien ne s'efface) : il n'y a pas d'image à dégager.
 */
export function CastControlView({ cast, item, mediaSourceId, onBack }: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isTablet = Math.min(width, height) >= TABLET_MIN_WIDTH;
  const ui = isTablet ? 1.4 : 1;
  const art = useMemo(() => loadingArt(client, item), [client, item]);
  const background = art.backdropUrl ?? art.posterUrl;
  const busy = cast.phase === "connecting" || cast.phase === "loading" || cast.phase === "buffering";
  const label = cast.phase === "connecting"
    ? t("cast.connecting", { device: cast.deviceName ?? "" })
    : cast.deviceName ? t("cast.playingOn", { device: cast.deviceName }) : t("cast.playingOnTv");
  const failure = cast.failure ? t("cast.failed") : null;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: PLAYER.bg }]}>
      {background && (
        <Image source={{ uri: background }} contentFit="cover" style={StyleSheet.absoluteFill} transition={300} accessible={false} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: PLAYER.scrimStrong }]} />
      <PlayerTopBar title={item?.Name ?? ""} ui={ui} onBack={onBack} />

      <View style={{ alignItems: "center", gap: 8, marginTop: 12, paddingHorizontal: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {busy ? <ActivityIndicator color={PLAYER.accentLight} /> : <Cast size={Math.round(18 * ui)} color={PLAYER.accentLight} />}
          <Text style={{ color: PLAYER.text, fontSize: Math.round(15 * ui), fontWeight: "600" }} numberOfLines={1}>{label}</Text>
        </View>
        <Text style={{ color: failure ? PLAYER.error : PLAYER.textSecondary, fontSize: Math.round(13 * ui), textAlign: "center" }}>
          {failure ?? t("cast.hint")}
        </Text>
      </View>

      <CenterControls
        paused={cast.phase !== "playing" && cast.phase !== "buffering"}
        ui={ui}
        centerGap={Math.min(isTablet ? 76 : 36, Math.round(width * 0.05))}
        playSize={Math.min(isTablet ? 92 : 60, Math.round(height * 0.08))}
        hasPrevious={false}
        hasNext={false}
        onPlayPause={cast.togglePlay}
        onRewind={() => cast.seekBy(-10)}
        onForward={() => cast.seekBy(30)}
      />

      <View style={{ paddingLeft: insets.left, paddingRight: Math.max(8, insets.right) }}>
        <PlayerSeekBar currentTime={cast.position} duration={cast.duration} onSeek={cast.seekTo} item={item} mediaSourceId={mediaSourceId} />
      </View>
      <View style={{ alignItems: "center", paddingBottom: Math.max(24, insets.bottom + 12), paddingTop: 8 }}>
        <Pressable
          onPress={cast.stop}
          accessibilityRole="button"
          style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: PLAYER.controlBg, borderWidth: 1, borderColor: PLAYER.border }}
        >
          <Text style={{ color: PLAYER.text, fontSize: Math.round(14 * ui), fontWeight: "600" }}>{t("cast.stop")}</Text>
        </Pressable>
      </View>
    </View>
  );
}
