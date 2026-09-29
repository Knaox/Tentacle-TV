import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import type { useJellyfinClient } from "@tentacle-tv/api-client";
import { resolveCardMarkers, type MediaItem } from "@tentacle-tv/shared";
import { ProgressBar } from "@/components/ui";
import { CardStatusMarkers } from "@/components/cards/CardStatusMarkers";
import { cardProgress } from "@/components/cards/cardProgress";
import { useCardDeviceState } from "@/hooks/offline/useDeviceState";
import { useTheme, useThemedStyles } from "@/theme";
import { MetaTokens } from "../detail/MetaTokens";
import { makeEpisodeRowStyles } from "./episodeRowStyles";
import { EpisodeThumb } from "./EpisodeThumb";

interface Props {
  ep: MediaItem;
  seriesId: string;
  /** La saison du conteneur — la bascule « vu », qui s'en servait, est passée à la feuille. */
  seasonId: string;
  client: ReturnType<typeof useJellyfinClient>;
  onPlay: (ep: MediaItem) => void;
  isCurrent?: boolean;
  /** Avant le « ⋯ » : le bouton « Garder hors ligne » de l'épisode. */
  leading?: ReactNode;
  /** L'appui long, et le « ⋯ » : la feuille des cartes (variante 16:9) sur la fiche ; rien dans le lecteur. */
  onLongPress?: (ep: MediaItem) => void;
}

/**
 * Une ligne d'épisode : vignette, numéro et titre, durée, résumé. Toucher
 * lance l'épisode.
 *
 * La grammaire des cartes : l'ÉTAT se lit sur la vignette et nulle part
 * ailleurs — la pastille du modèle (vu, sur cet appareil) et la barre commune
 * (`cardProgress`) ; les ACTIONS vivent dans la feuille des cartes, ouverte
 * par l'appui long ou par le « ⋯ » qui la rend visible. Un rond « vu », plein
 * quand l'épisode l'était, tenait lieu de marqueur au bout de la ligne : il
 * doublait la pastille, et n'était pas celui du modèle. Dans le lecteur, sans
 * feuille, la ligne ne porte que son état.
 */
export function EpisodeItemRow({ ep, seriesId, client, onPlay, isCurrent, leading, onLongPress }: Props) {
  const { t } = useTranslation(["common", "cards"]);
  const { colors, isDark } = useTheme();
  const st = useThemedStyles(makeEpisodeRowStyles);
  // Texte d'accent lisible : la nuance vive en sombre, la foncée en clair.
  const accentText = isDark ? colors.brand.accentLight : colors.brand.accent;
  // Le modèle des marqueurs, réduit à ce qu'une LIGNE dit d'un épisode : vu,
  // et sur cet appareil. Ma liste et les favoris vivent au niveau de la série.
  const device = useCardDeviceState(ep);
  const markers = resolveCardMarkers({ item: ep, communityRating: null, inWatchlist: false, isFavorite: false, device });
  const progress = cardProgress(ep);
  const runtime = ep.RunTimeTicks ? Math.round(ep.RunTimeTicks / 600_000_000) : null;
  const epLabel = ep.IndexNumber != null
    ? `S${String(ep.ParentIndexNumber ?? 1).padStart(2, "0")}E${String(ep.IndexNumber).padStart(2, "0")} · `
    : "";

  return (
    <View style={st.row}>
      <Pressable
        onPress={() => onPlay(ep)}
        onLongPress={onLongPress ? () => onLongPress(ep) : undefined}
        style={st.main}
      >
        <View style={st.thumb}>
          <EpisodeThumb ep={ep} seriesId={seriesId} client={client} />
          {progress !== null && (
            <View style={local.progress}>
              <ProgressBar progress={progress / 100} height={3} />
            </View>
          )}
          <CardStatusMarkers statuses={markers.statuses} device={markers.device} style={local.status} />
        </View>
        <View style={st.body}>
          <View style={st.titleRow}>
            {isCurrent && <View style={st.currentDot} />}
            <Text numberOfLines={1} style={[st.title, isCurrent && { fontWeight: "800" }]}>
              {epLabel}{ep.Name}
            </Text>
          </View>
          <View style={st.metaRow}>
            {isCurrent && <Text style={[st.current, { color: accentText }]}>{t("currentEpisode")}</Text>}
            {runtime && <Text style={st.runtime}>{t("minutesShort", { count: runtime })}</Text>}
          </View>
          <MetaTokens item={ep} compact />
          {ep.Overview && <Text numberOfLines={2} style={st.overview}>{ep.Overview}</Text>}
        </View>
      </Pressable>

      {leading}

      {/* Le « ⋯ » : la feuille des actions — vu, garder hors ligne, fiche,
          note —, la même que l'appui long, rendue visible. */}
      {onLongPress ? (
        <Pressable
          onPress={() => onLongPress(ep)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${t("cards:moreActions")} — ${ep.Name ?? ""}`}
          style={st.toggle}
        >
          <View style={local.more}>
            <Feather name="more-horizontal" size={20} color={colors.text.secondary} />
          </View>
        </Pressable>
      ) : (
        <View style={local.end} />
      )}
    </View>
  );
}

// Propre à la ligne en ligne : sa jumelle hors ligne garde, pour l'instant,
// la piste des styles partagés (`episodeRowStyles`).
const local = StyleSheet.create({
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 4, paddingBottom: 4 },
  status: { top: 4, right: 4 },
  more: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  end: { width: 10 },
});
