import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useInterfaceLanguage, useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "../../theme";
import { SegmentedChoice } from "../settings/SegmentedChoice";

interface Props {
  /** La section qui l'héberge porte déjà le titre « Langue ». */
  hideLabel?: boolean;
}

/**
 * Sélecteur de langue d'interface — synchronisé avec le backend (DB), comme
 * sur web/TV : reflète la langue stockée côté serveur (changée depuis un
 * autre appareil) et la persiste au changement. Le sélecteur segmenté
 * commun (même cadre et même dégradé que le web).
 */
export function LanguageToggle({ hideLabel }: Props) {
  const { t, i18n } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const { data: dbLang } = useInterfaceLanguage();
  const setLangMut = useSetInterfaceLanguage();
  const st = useThemedStyles(makeStyles);

  // Reflète la langue en base (source de vérité inter-appareils).
  useEffect(() => {
    const lang = dbLang?.language;
    if (lang && lang !== i18n.language) {
      i18n.changeLanguage(lang);
      storage.setItem("tentacle_language", lang);
    }
  }, [dbLang?.language, i18n, storage]);

  const currentLang = i18n.language?.startsWith("fr") ? "fr" : "en";
  const switchLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    storage.setItem("tentacle_language", lng);
    setLangMut.mutate(lng); // persiste en DB → suit sur les autres appareils
  };

  return (
    <View>
      {!hideLabel && <Text style={st.langLabel}>{t("language")}</Text>}
      <SegmentedChoice
        options={[{ value: "fr", label: t("french") }, { value: "en", label: t("english") }]}
        value={currentLang}
        onChange={switchLanguage}
        accessibilityLabel={t("language")}
      />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    langLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: t.colors.text.tertiary, marginBottom: spacing.sm },
  });
