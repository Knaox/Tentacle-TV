/**
 * Octave mobile — la carte d'un MIX de l'accueil : une mosaïque de quatre
 * pochettes (ou une seule, `mixMosaic`), son nom, ses artistes (`mixTitle`,
 * `mixSubtitle`, les règles du bureau). Un mix n'a pas de page : la carte LIT ;
 * le mix en cours se reconnaît et la carte le met en pause ou le reprend.
 */

import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react-native";
import { mixContextId, mixMosaic, mixSubtitle, mixTitle } from "@tentacle-tv/shared/octave";
import type { MusicHomeMix } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography, useTheme, withAlpha } from "@/theme";
import { usePagesContextId, usePagesPlayer, usePagesWantsPlay } from "../env/pagesPlayer";
import { Artwork } from "../ui/Artwork";
import { accentTextOf } from "../ui/pageStyle";
import { playFrom } from "../env/playFrom";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";
import { useOctaveColors } from "../../theme/octaveColors";

function Mosaic({ urls, size }: { urls: readonly string[]; size: number }) {
  if (urls.length < 4) return <Artwork url={urls[0] ?? null} size={size} radius={10} />;
  const half = size / 2;
  return (
    <View style={[styles.mosaic, { width: size, height: size }]}>
      {urls.map((url) => (
        <Artwork key={url} url={url} size={half} radius={0} />
      ))}
    </View>
  );
}

export const MixCard = memo(function MixCard({ mix, width }: { mix: MusicHomeMix; width: number }) {
  const { t, i18n } = useTranslation("music");
  const theme = useTheme();
  const colors = useOctaveColors();
  const player = usePagesPlayer();
  const contextId = mixContextId(mix);
  const current = usePagesContextId() === contextId;
  const wantsPlay = usePagesWantsPlay();
  const playing = current && wantsPlay;
  const urls = useMemo(() => mixMosaic(mix.tracks), [mix.tracks]);
  const title = mixTitle(mix);
  const name = title.key === "octaveHome.mixArtist" ? t(title.key, { artist: title.artist }) : t(title.key);
  const toggle = () => {
    if (!player) return;
    if (current) player.togglePlay();
    else playFrom(player, mix.tracks, 0, contextId);
  };
  const Icon = playing ? Pause : Play;
  return (
    <PressableCard onPress={toggle} style={{ width }} accessibilityRole="button" accessibilityLabel={name}>
      <View>
        <Mosaic urls={urls} size={width} />
        <View style={[styles.badge, { borderColor: withAlpha(colors.onBrandFill, 0.7, colors.onBrandFill) }]}>
          <OctaveBrandFill radius={18} />
          <Icon size={16} color={colors.onBrandFill} fill={colors.onBrandFill} />
        </View>
      </View>
      <Text numberOfLines={1} style={[typography.bodyBold, styles.title, { color: current ? accentTextOf(theme) : theme.colors.text.primary }]}>
        {name}
      </Text>
      <Text numberOfLines={2} style={[typography.caption, { color: theme.colors.text.tertiary }]}>
        {mixSubtitle(mix, i18n.language)}
      </Text>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  mosaic: { flexDirection: "row", flexWrap: "wrap", borderRadius: 10, overflow: "hidden" },
  // Détachée de la mosaïque (souvent violet → rose elle aussi) : un liseré clair et une ombre portée.
  badge: { position: "absolute", right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  title: { fontSize: 14, marginTop: 8 },
});
