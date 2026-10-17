import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BELOW_ZONE_VIEWPORT, PREVIEW_STAGE_HEIGHT, PREVIEW_ZONE_HEIGHT } from "@tentacle-tv/tv-core";

/**
 * Le cadre d'une page À ZONE (tv-core `focus/previewZoneLayout.ts`) :
 * l'Accueil, « Pour vous », les grilles. En haut, la ZONE FIXE de l'aperçu
 * (`zone`, 40 % de l'écran), qui ne défile jamais ; dessous, la FENÊTRE de la
 * page (`children` : sa ScrollView, sa liste), qui défile dans sa hauteur à
 * elle — jamais sous la zone : tvOS ne focalise pas un élément recouvert par
 * ce qui dessine.
 *
 * La zone ne prend que ce qu'elle dessine (`box-none`) ; la navigation, le
 * fond et les panneaux de la page restent ses frères, hors du cadre.
 */
export const BelowZonePage = memo(function BelowZonePage({ zone, children }: { zone?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.page} pointerEvents="box-none">
      <View style={styles.zone} pointerEvents="box-none">
        {zone}
      </View>
      <View style={styles.window}>{children}</View>
    </View>
  );
});

// Des hauteurs explicites : une liste (FlashList) veut un parent de taille connue, et un
// `flex: 1` peut écraser la page à 1 point sous un guide de focus sans style.
const styles = StyleSheet.create({
  page: { height: PREVIEW_STAGE_HEIGHT },
  zone: { height: PREVIEW_ZONE_HEIGHT },
  window: { height: BELOW_ZONE_VIEWPORT },
});
