import { createContext, memo, useContext, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useStagedMount } from "../../motion/useStagedMount";
import { text } from "../../theme/tokens";
import type { DetailSectionKey } from "./detailTypes";

/**
 * Une section de la fiche, sous l'en-tête : son titre de rangée (36 pt),
 * un accessoire à sa droite (le résumé d'une saga), puis son contenu. Elle
 * dit sa position à la page, qui s'y ancre quand le focus y entre.
 *
 * Dans une page qui ARRIVE (`SectionStage`), le titre est là tout de suite —
 * celui de la première section affleure au pied du premier écran —, le
 * contenu se monte après l'entrée de la page, une section par image, dans
 * l'ordre de la fiche : il est encore sous le bord, rien ne se voit monter.
 */

/** La colonne de contenu de la fiche : pas de navigation, la marge de sécurité et un peu d'air. */
export const DETAIL_LEFT = TV_STAGE.safe.x + 24;

/** Le rang de montage de chaque section, dans l'ordre de la fiche. */
const RANK: Record<DetailSectionKey, number> = { header: 0, collection: 0, episodes: 1, cast: 2, extras: 3, saga: 4, similar: 5 };
const RANKS = 6;

/** Les rangs libérés (`useStagedMount`) ; hors d'une page qui arrive, tous. */
const SectionStageContext = createContext(Number.POSITIVE_INFINITY);

/** Une page qui arrive : le contenu de ses sections se monte après son entrée. */
export function SectionStage({ children }: { children: ReactNode }) {
  const released = useStagedMount(RANKS);
  return <SectionStageContext.Provider value={released}>{children}</SectionStageContext.Provider>;
}

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
  const shown = RANK[sectionKey] < useContext(SectionStageContext);
  return (
    <View style={styles.section} onLayout={(event) => onLayout(sectionKey, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}>
      {title ? (
        <View style={styles.header}>
          <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
          {accessory}
        </View>
      ) : null}
      {shown ? children : null}
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: TV_STAGE.row.spacing - 16 },
  header: { flexDirection: "row", alignItems: "baseline", gap: 20, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, marginBottom: TV_STAGE.row.titleGap - 8 },
});
