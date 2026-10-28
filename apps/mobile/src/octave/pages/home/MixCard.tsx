/**
 * Octave mobile — la carte d'un MIX de l'accueil : une mosaïque de quatre
 * pochettes (ou une seule, `mixMosaic`), son nom, ses artistes (`mixTitle`,
 * `mixSubtitle`, les règles du bureau). Comme le bureau et comme un album :
 * toucher la carte OUVRE la page du mix (`OctaveHomeMixScreen`), le bouton rond
 * le LIT sans quitter l'accueil ; le mix en cours se reconnaît et le bouton le
 * met en pause ou le reprend.
 */

import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Pause, Play } from "lucide-react-native";
import { mixContextId, mixMosaic, mixSubtitle, mixTitle } from "@tentacle-tv/shared/octave";
import type { MusicHomeMix } from "@tentacle-tv/shared/music";
import { PressableCard } from "@/components/ui";
import { typography, useTheme, withAlpha } from "@/theme";
import { usePagesContextId, usePagesPlayer, usePagesWantsPlay } from "../env/pagesPlayer";
import { PlaylistArtwork } from "../ui/PlaylistArtwork";
import { useOctaveNav } from "../env/nav";
import { accentTextOf } from "../ui/pageStyle";
import { playFrom } from "../env/playFrom";
import { OctaveBrandFill } from "../../layout/OctaveBrandFill";
import { useOctaveColors } from "../../theme/octaveColors";

export const MixCard = memo(function MixCard({ mix, width }: { mix: MusicHomeMix; width: number }) {
  const { t, i18n } = useTranslation("music");
  const theme = useTheme();
  const colors = useOctaveColors();
  const player = usePagesPlayer();
  const nav = useOctaveNav();
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
    <PressableCard onPress={() => nav.homeMix(mix.id)} style={{ width }} accessibilityRole="button" accessibilityLabel={t("octaveHome.mixOpen", { title: name })}>
      <View>
        <PlaylistArtwork urls={urls} size={width} radius={10} />
        {/* Cible de 44 pt (pastille de 36 + marge de toucher) : lit sans ouvrir. */}
        <Pressable onPress={toggle} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("octaveHome.mixPlay", { title: name })} style={[styles.badge, { borderColor: withAlpha(colors.onBrandFill, 0.7, colors.onBrandFill) }]}>
          <OctaveBrandFill radius={18} />
          <Icon size={16} color={colors.onBrandFill} fill={colors.onBrandFill} />
        </Pressable>
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
  // Détachée de la mosaïque (souvent violet → rose elle aussi) : un liseré clair et une ombre portée.
  badge: { position: "absolute", right: 8, bottom: 8, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, shadowColor: "#000", shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 6 },
  title: { fontSize: 14, marginTop: 8 },
});
