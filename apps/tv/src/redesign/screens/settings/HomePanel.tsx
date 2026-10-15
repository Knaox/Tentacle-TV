import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { heroModeHintKey, heroModeLabelKey, recoHeroKindOf, type HeroMode } from "@tentacle-tv/shared";
import { SETTINGS_HERO_CHANGE_FIXED, settingsHeroKey } from "@tentacle-tv/tv-core";
import { Chip } from "../../controls/Chip";
import type { IconName } from "../../icons/Icon";
import { SectionTitle, settingsText } from "./settingsParts";
import type { SettingsHome } from "./settingsTypes";

/**
 * L'onglet « Accueil » des réglages (Apple TV et Android TV) : la section
 * « Bandeau principal ». Une pastille par source, la retenue cochée — le motif
 * des autres choix uniques des réglages (mode du lecteur, taille des cartes) —,
 * et dessous, en clair, ce que la source MET dans le bandeau ; « Un titre
 * choisi » dit en plus le titre à l'affiche et offre « Changer de titre »
 * (la liste de choix des réglages, sur les favoris). Les sources « Pour
 * vous » rappellent leur repli : sans recommandation, la reprise.
 *
 * Ce que fait OK : tv-core `hero/heroSourceSettings.ts`. Clés de focus :
 * `settings:hero:<source>`, `settings:hero:changeFixed`.
 */

/** Le signe de chaque source au repos ; la retenue porte la coche. */
const ICONS: Readonly<Record<HeroMode, IconName>> = {
  resume: "playCircle",
  random: "refresh",
  reco: "sparkles",
  recoMovies: "film",
  recoSeries: "tv",
  fixed: "bookmark",
};

export const HomePanel = memo(function HomePanel({ home, onSelectHeroMode, onChangeFixedTitle }: {
  home: SettingsHome;
  onSelectHeroMode?: (mode: HeroMode) => void;
  onChangeFixedTitle?: () => void;
}) {
  const { t } = useTranslation("homeSettings");
  const { current } = home;
  const fixed = current === "fixed";
  return (
    <View style={styles.root}>
      <View>
        <SectionTitle title={t("heroTitle")} caption={t("heroCaption")} />
        <View style={styles.chips}>
          {home.modes.map((mode) => (
            <Chip
              key={mode}
              label={t(heroModeLabelKey(mode))}
              icon={mode === current ? "check" : ICONS[mode]}
              selected={mode === current}
              focusKey={settingsHeroKey(mode)}
              onPress={onSelectHeroMode ? () => onSelectHeroMode(mode) : undefined}
            />
          ))}
        </View>
        <Text style={[settingsText.hint, styles.hint]}>{t(heroModeHintKey(current))}</Text>
        {recoHeroKindOf(current) ? <Text style={[settingsText.small, styles.note]}>{t("heroFallbackNote")}</Text> : null}
        {fixed && home.fixedTitle ? (
          <Text style={[settingsText.value, styles.note]} numberOfLines={1}>{t("heroFixedCurrent", { title: home.fixedTitle })}</Text>
        ) : null}
        {home.noFavorites ? <Text style={[settingsText.small, styles.note]}>{t("heroFixedNoFavorites")}</Text> : null}
        {fixed ? (
          <View style={styles.action}>
            <Chip
              label={t("heroFixedChange")}
              icon="bookmark"
              trailingIcon="chevronRight"
              focusKey={SETTINGS_HERO_CHANGE_FIXED}
              onPress={onChangeFixedTitle}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: 56 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  hint: { marginTop: 22, maxWidth: 1040 },
  note: { marginTop: 12, maxWidth: 1040 },
  action: { flexDirection: "row", marginTop: 22 },
});
