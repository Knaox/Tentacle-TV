import { createContext, memo, useCallback, useContext, useState, type ReactNode } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { BELOW_ZONE_VIEWPORT, PREVIEW_STAGE_HEIGHT, PREVIEW_ZONE_HEIGHT, belowZoneBottomRoom } from "@tentacle-tv/tv-core";
import { PreviewZoneScope } from "../cards/trailerPreviewPort";

/**
 * Le cadre d'une page À ZONE (tv-core `focus/previewZoneLayout.ts`) :
 * l'Accueil, « Pour vous », les grilles. En haut, la ZONE FIXE de l'aperçu
 * (`zone`, 40 % de l'écran), qui ne défile jamais ; dessous, la FENÊTRE de la
 * page (`children` : sa ScrollView, sa liste), qui défile dans sa hauteur à
 * elle — jamais sous la zone : tvOS ne focalise pas un élément recouvert par
 * ce qui dessine.
 *
 * La zone ne prend que ce qu'elle dessine (`box-none`) ; son fond et sa vidéo
 * débordent sous elle, DERRIÈRE la fenêtre (posée après, sans fond). La
 * navigation, le fond et les panneaux de la page restent ses frères, hors du
 * cadre. Tout le cadre est UNE portée de la zone (`PreviewZoneScope`) : ses
 * cartes disent leur focus à SA zone.
 *
 * Seules les cartes d'une page à zone demandent l'aperçu de leur
 * bande-annonce (`useInPreviewZone`) : ailleurs (la recherche, une fiche),
 * rien ne le jouerait.
 */
export const BelowZonePage = memo(function BelowZonePage({ zone, children }: { zone?: ReactNode; children: ReactNode }) {
  return (
    <PreviewZoneScope>
      <View style={styles.page} pointerEvents="box-none">
        <View style={styles.zone} pointerEvents="box-none">
          {zone}
        </View>
        <InZoneContext.Provider value>
          <View style={styles.window}>{children}</View>
        </InZoneContext.Provider>
      </View>
    </PreviewZoneScope>
  );
});

const InZoneContext = createContext(false);

/** La carte est dans une page à zone : son focus peut demander l'aperçu. */
export function useInPreviewZone(): boolean {
  return useContext(InZoneContext);
}

/**
 * La marge du bas d'une page de rangées sous la zone : de quoi poser sa
 * DERNIÈRE rangée au même endroit que les autres (tv-core
 * `belowZoneBottomRoom`), d'après sa hauteur mesurée — `onLastLayout` sur la
 * dernière section seulement. Une mesure par mise en page de la rangée,
 * jamais au changement de focus. `atLeast` : la marge d'avant, au moins.
 */
export function useBelowZoneBottomRoom(atLeast: number): { room: number; onLastLayout: (event: LayoutChangeEvent) => void } {
  const [last, setLast] = useState<number | null>(null);
  const onLastLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setLast((before) => (before === height ? before : height));
  }, []);
  return { room: Math.max(atLeast, last === null ? 0 : belowZoneBottomRoom(last)), onLastLayout };
}

// Des hauteurs explicites : une liste (FlashList) veut un parent de taille connue, et un
// `flex: 1` peut écraser la page à 1 point sous un guide de focus sans style.
const styles = StyleSheet.create({
  page: { height: PREVIEW_STAGE_HEIGHT },
  zone: { height: PREVIEW_ZONE_HEIGHT },
  window: { height: BELOW_ZONE_VIEWPORT },
});
