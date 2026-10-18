import { memo } from "react";
import { StyleSheet } from "react-native";
import { PreviewZoneSlot } from "../cards/trailerPreviewPort";
import type { CardModel } from "../cards/cardTypes";
import { FocusSection } from "../focus/FocusSection";
import type { HeroModel } from "../hero/heroTypes";
import { HeroZoneHead, type HeroZoneHeadProps } from "./HeroZoneHead";
import { ZONE } from "./zoneModel";

/**
 * La zone d'une page À HÉROS (l'Accueil, « Pour vous ») : la zone d'aperçu
 * (`PreviewZoneSlot`), qui dessine le titre mis en avant — ou la carte
 * focalisée —, et par-dessus, les boutons du héros dans leur section
 * (`section:hero`) : HAUT depuis la première rangée y mène, au-dessus de la
 * page. Sans héros : la zone seule, sur son repli.
 */
export const HeroZone = memo(function HeroZone({ hero, fallback = null, ...head }: Omit<HeroZoneHeadProps, "hero"> & {
  hero: HeroModel | null;
  fallback?: CardModel | null;
}) {
  return (
    <>
      <PreviewZoneSlot hero={hero} fallback={fallback} />
      {hero ? (
        <FocusSection focusKey="section:hero" style={styles.head}>
          <HeroZoneHead hero={hero} {...head} />
        </FocusSection>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  // Sur la ligne du bas de la zone, au retrait du contenu.
  head: {
    position: "absolute",
    left: ZONE.left,
    right: ZONE.right,
    // Calée sur le BAS de la zone : elle suit sa hauteur (celle de la page).
    bottom: ZONE.bottom,
    height: ZONE.heroActions,
  },
});
