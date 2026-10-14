import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CARD_SIZES, type CardSize } from "@tentacle-tv/tv-core";
import { Chip } from "../../controls/Chip";
import { SectionTitle, settingsText } from "./settingsParts";

/**
 * La section « Taille des cartes » de l'onglet Apparence (Apple TV et
 * Android TV) : Petite · Normale · Grande, en pastilles comme les autres
 * choix uniques — chacune avec sa vignette, plus ou moins grande ; dessous, ce que fait la taille choisie. Le changement
 * s'applique aussitôt à toute l'app, sans relance (`CardSizeProvider`) ;
 * `onSelect` écrit le réglage de l'appareil.
 *
 * Clés de focus : `settings:cardSize:<small|normal|large>`.
 */

const LABEL_KEYS: Readonly<Record<CardSize, string>> = {
  small: "cardSizeSmall",
  normal: "cardSizeNormal",
  large: "cardSizeLarge",
};

/** Le signe de chaque pastille : une vignette 16:9 qui grandit avec la taille,
 *  dans une boîte fixe — la pastille garde sa largeur d'un choix à l'autre. */
const GLYPH_WIDTH: Readonly<Record<CardSize, number>> = { small: 18, normal: 25, large: 32 };
const GLYPH_BOX = { width: 34, height: 22 };
/** Un gris lisible sur le verre comme sur le blanc du focus (le signe est le même dans les deux). */
const GLYPH_COLOR = "rgba(140, 140, 150, 0.95)";

function SizeGlyph({ size }: { size: CardSize }) {
  const width = GLYPH_WIDTH[size];
  return (
    <View style={styles.glyphBox}>
      <View style={[styles.glyph, { width, height: Math.round((width * 9) / 16) }]} />
    </View>
  );
}

const HINT_KEYS: Readonly<Record<CardSize, string>> = {
  small: "cardSizeSmallHint",
  normal: "cardSizeNormalHint",
  large: "cardSizeLargeHint",
};

export const CardSizeSection = memo(function CardSizeSection({ size, onSelect }: {
  size: CardSize;
  onSelect?: (size: CardSize) => void;
}) {
  const { t } = useTranslation("preferences");
  return (
    <View>
      <SectionTitle title={t("cardSizeTitle")} caption={t("cardSizeCaption")} />
      <View style={styles.chips}>
        {CARD_SIZES.map((choice) => (
          <Chip
            key={choice}
            label={t(LABEL_KEYS[choice])}
            leading={<SizeGlyph size={choice} />}
            selected={size === choice}
            focusKey={`settings:cardSize:${choice}`}
            onPress={onSelect && size !== choice ? () => onSelect(choice) : undefined}
          />
        ))}
      </View>
      <Text style={[settingsText.hint, styles.hint]}>{t(HINT_KEYS[size])}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 8 },
  hint: { marginTop: 22, maxWidth: 1040 },
  glyphBox: { ...GLYPH_BOX, alignItems: "center", justifyContent: "center" },
  glyph: { borderRadius: 4, borderWidth: 2.5, borderColor: GLYPH_COLOR },
});
