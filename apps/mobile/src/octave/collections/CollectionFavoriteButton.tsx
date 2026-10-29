/**
 * Octave mobile — le CŒUR d'un album, d'un artiste ou d'une playlist, dans la barre du haut de sa page (comme
 * Apple Music : la tête garde Lecture et Aléatoire) : un rond de verre de 44 pt, plein et à l'accent quand l'élément est en favori. Le geste partagé
 * (`useToggleShelfFavorite`) se voit aussitôt partout (« Vos favoris », l'accueil) ; un refus le défait et
 * le dit. Absent là où le serveur ne garde pas ce favori (`hasCollectionActions`, capacité
 * `music.libraryFavorites`) ; hors ligne, il montre l'état gardé mais ne change rien et le dit.
 */

import { memo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react-native";
import { shelfFavoriteOf, useMusicShelves, useToggleShelfFavorite, type MusicShelfSubject } from "@tentacle-tv/api-client";
import { GlassSurface } from "@/components/ui";
import { useOfflineMode } from "@/offline/useOfflineMode";
import { useTheme } from "@/theme";
import { haptic } from "@/utils/haptics";
import { showNotice } from "../pages/env/notices";
import { accentTextOf } from "../pages/ui/pageStyle";
import { hasCollectionActions } from "./collectionEligibility";
import { subjectName } from "./CollectionSheetHeader";

export const CollectionFavoriteButton = memo(function CollectionFavoriteButton({ subject }: { subject: MusicShelfSubject }) {
  const { t } = useTranslation("musicFavorites");
  const { t: to } = useTranslation("musicOffline");
  const theme = useTheme();
  const offline = useOfflineMode();
  const { capable, shelves } = useMusicShelves();
  const toggle = useToggleShelfFavorite();
  const favorite = shelfFavoriteOf(subject, shelves, capable);
  if (favorite === undefined || !hasCollectionActions(subject, capable)) return null;
  const name = subjectName(subject);
  const color = favorite ? accentTextOf(theme) : theme.colors.text.primary;
  const press = () => {
    if (offline) {
      showNotice("info", to("view.offlineHint"));
      return;
    }
    const next = !favorite;
    haptic(next ? "success" : "tap");
    toggle.mutate(
      { subject, favorite: next },
      {
        onSuccess: () => showNotice("success", t(next ? "added" : "removed", { name })),
        onError: () => showNotice("error", t("failed")),
      },
    );
  };
  return (
    <Pressable
      onPress={press}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!favorite }}
      accessibilityLabel={t(favorite ? "actions.unfavorite" : "actions.favorite")}
      hitSlop={6}
    >
      <GlassSurface tier="subtle" tint="regular" radius={22} interactive style={styles.round}>
        <Heart size={20} color={color} fill={favorite ? color : "transparent"} />
      </GlassSurface>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  round: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
