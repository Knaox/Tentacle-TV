import { memo, useCallback, useMemo, type ReactNode } from "react";
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { TV_STAGE } from "@tentacle-tv/theme";
import { openPageBottomRoom } from "@tentacle-tv/tv-core";
import { FocusSection, type FocusSectionReveal } from "../focus/FocusSection";
import { useRowRewindPort } from "../rows/rowRewindPort";
import { RowStageProvider } from "../rows/rowStage";
import { useForcedFocusReveal } from "../screens/shared/useForcedFocusReveal";
import { OpenCardPage, useOpenCardMetrics } from "./OpenCardPage";

/**
 * Le corps d'une page EN RANGÉES — une bibliothèque, Ma liste, Mes favoris
 * (banc validé par Damien le 19/10, au lieu de la grille) : l'en-tête de la
 * page (titre, compte, barre de filtres « Ranger par » en tête), puis les
 * rangées (`OpenRowSection`), la même taille de carte que l'Accueil. La
 * bande-annonce se joue derrière la carte ouverte (`OpenCardPage`) ; la
 * dernière rangée se pose à l'ancrage comme les autres (`openPageBottomRoom`).
 *
 * L'en-tête revient au début de la page quand le focus y remonte. Les
 * rangées reviennent au début une fois sorties de l'écran (port des rangées).
 */
const HEADER_REVEAL: FocusSectionReveal = { mode: "start" };

export const OpenRowsBody = memo(function OpenRowsBody({ header, empty, children }: {
  header: ReactNode;
  /** À la place des rangées : le chargement, le vide des filtres trop serrés. */
  empty?: ReactNode;
  children?: ReactNode;
}) {
  const { scrollRef, onViewportLayout } = useForcedFocusReveal();
  const rewind = useRowRewindPort();
  const metrics = useOpenCardMetrics();
  const content = useMemo(() => [styles.content, { paddingBottom: openPageBottomRoom(metrics) }], [metrics]);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement } = event.nativeEvent;
      rewind?.scroll(contentOffset.y, layoutMeasurement.height);
    },
    [rewind],
  );
  return (
    <RowStageProvider>
      <OpenCardPage hero={null}>
        <ScrollView
          ref={scrollRef}
          style={styles.fill}
          contentContainerStyle={content}
          showsVerticalScrollIndicator={false}
          onLayout={onViewportLayout}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          <FocusSection reveal={HEADER_REVEAL} style={styles.header}>{header}</FocusSection>
          {empty ? <View style={styles.empty}>{empty}</View> : children}
        </ScrollView>
      </OpenCardPage>
    </RowStageProvider>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingTop: TV_STAGE.safe.y },
  header: { paddingLeft: TV_STAGE.contentLeft, paddingRight: TV_STAGE.safe.x, marginBottom: 12 },
  empty: { paddingLeft: TV_STAGE.contentLeft, paddingRight: TV_STAGE.safe.x },
});
