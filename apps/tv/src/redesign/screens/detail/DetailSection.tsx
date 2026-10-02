import { createContext, memo, useContext, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { FocusSection, type FocusSectionReveal } from "../../focus/FocusSection";
import { useStagedMount } from "../../motion/useStagedMount";
import { text } from "../../theme/tokens";
import type { DetailSectionKey } from "./detailTypes";

/**
 * Une section de la fiche, sous l'en-tête : son titre de rangée (36 pt),
 * un accessoire à sa droite (le résumé d'une saga), puis son contenu. Quand
 * le focus y entre, la page s'y ANCRE — son titre à `SECTION_ANCHOR_TOP` du
 * haut de l'écran —, en un seul mouvement (`FocusSection`) ; elle dit aussi
 * sa position à la page (le pied de page, le focus figé du banc).
 *
 * Dans une page qui ARRIVE (`SectionStage`), le titre est là tout de suite —
 * celui de la première section affleure au pied du premier écran —, le
 * contenu se monte après l'entrée de la page, une section par image, dans
 * l'ordre de la fiche : il est encore sous le bord, rien ne se voit monter.
 */

/** La colonne de contenu de la fiche : pas de navigation, la marge de sécurité et un peu d'air. */
export const DETAIL_LEFT = TV_STAGE.safe.x + 24;

/** Où arrive le haut d'une section ancrée : sous la marge de sécurité. */
export const SECTION_ANCHOR_TOP = 72;
const ANCHOR: FocusSectionReveal = { mode: "anchor", top: SECTION_ANCHOR_TOP };

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
    <FocusSection
      reveal={ANCHOR}
      style={styles.section}
      onLayout={(event) => onLayout(sectionKey, event.nativeEvent.layout.y, event.nativeEvent.layout.height)}
    >
      {title ? (
        <View style={styles.header}>
          <Text style={text.rowTitle} numberOfLines={1}>{title}</Text>
          {accessory}
        </View>
      ) : null}
      {shown ? children : null}
    </FocusSection>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: TV_STAGE.row.spacing - 16 },
  header: { flexDirection: "row", alignItems: "baseline", gap: 20, paddingLeft: DETAIL_LEFT, paddingRight: TV_STAGE.safe.x, marginBottom: TV_STAGE.row.titleGap - 8 },
});
