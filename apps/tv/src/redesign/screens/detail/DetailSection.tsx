import { memo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { text } from "../../theme/tokens";
import type { DetailSectionKey } from "./detailTypes";

/**
 * Une section de la fiche, sous l'en-tête : son titre de rangée (36 pt),
 * un accessoire à sa droite (le résumé d'une saga), puis son contenu. Elle
 * dit sa position à la page, qui s'y ancre quand le focus y entre.
 */

/** La colonne de contenu de la fiche : pas de navigation, la marge de sécurité et un peu d'air. */
export const DETAIL_LEFT = TV_STAGE.safe.x + 24;

export const DetailSection = memo(function DetailSection({
  sectionKey,
  title,
  accessory,
  onLayout,
  children,
}: {
  sectionKey: DetailSectionKey;
  title?: string;
  accessory?: ReactNode;
  onLayout: (key: DetailSectionKey, y: number, height: number) => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} onLayout={(event) => onLayout(sectionKey, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}>
      {title ? (
        <View style={styles.header}>
          <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
          {accessory}
        </View>
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: TV_STAGE.row.spacing - 16 },
  header: { flexDirection: "row", alignItems: "baseline", gap: 20, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, marginBottom: TV_STAGE.row.titleGap - 8 },
});
