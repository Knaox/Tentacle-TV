import { memo, useMemo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { openCardMetricsOf, openStageRects, type OpenCardMetrics } from "@tentacle-tv/tv-core";
import { TV_STAGE } from "@tentacle-tv/theme";
import { useCardMetrics } from "../cards/cardSizeMode";
import { PreviewZoneScope, PreviewZoneSlot } from "../cards/trailerPreviewPort";
import type { HeroModel } from "../hero/heroTypes";

/**
 * Le cadre d'une page à cartes qui S'OUVRENT (tv-core `cards/openCard.ts`) :
 * l'Accueil, « Pour vous », Ma liste, Mes favoris, les bibliothèques. Plus de
 * zone fixe : la page occupe tout l'écran, et sa SCÈNE (le lecteur unique,
 * `PreviewZoneSlot stage`) est posée DERRIÈRE elle — au rectangle de la carte
 * ouverte ou de la bannière. Rien ne recouvre une cible.
 *
 * Tout le cadre est UNE portée d'aperçu (`PreviewZoneScope`) : ses cartes et sa
 * bannière disent leur focus à SA scène.
 */
export const OpenCardPage = memo(function OpenCardPage({ hero = null, children }: { hero?: HeroModel | null; children: ReactNode }) {
  const metrics = useOpenCardMetrics();
  const stage = useMemo(() => openStageRects(metrics, TV_STAGE.contentLeft), [metrics]);
  return (
    <PreviewZoneScope>
      <View style={styles.page} pointerEvents="box-none">
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <PreviewZoneSlot hero={hero} stage={stage} />
        </View>
        {children}
      </View>
    </PreviewZoneScope>
  );
});

/** Les mesures de la carte qui s'ouvre, à la taille réglée — les mêmes sur toutes les pages. */
export function useOpenCardMetrics(): OpenCardMetrics {
  const { size } = useCardMetrics();
  return useMemo(() => openCardMetricsOf(size), [size]);
}

const styles = StyleSheet.create({
  page: { flex: 1 },
});
