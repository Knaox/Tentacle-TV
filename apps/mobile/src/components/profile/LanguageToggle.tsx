import { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTentacleConfig, useInterfaceLanguage, useSetInterfaceLanguage } from "@tentacle-tv/api-client";
import { colors, spacing, typography, BORDER, BRAND, FONT_FAMILY, RADIUS } from "../../theme";

/**
 * Sélecteur de langue d'interface — synchronisé avec le backend (DB), comme
 * sur web/TV : reflète la langue stockée côté serveur (changée depuis un
 * autre appareil) et la persiste au changement. Avant : purement local
 * (i18n + storage) — la préférence en base n'était ni lue ni écrite.
 */
export function LanguageToggle() {
  const { t, i18n } = useTranslation("profile");
  const { storage } = useTentacleConfig();
  const { data: dbLang } = useInterfaceLanguage();
  const setLangMut = useSetInterfaceLanguage();

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
      <Text style={st.langLabel}>{t("language")}</Text>
      <View style={{ flexDirection: "row", gap: spacing.sm }} accessibilityRole="radiogroup">
        <LangBtn active={currentLang === "fr"} label={t("french")} onPress={() => switchLanguage("fr")} />
        <LangBtn active={currentLang === "en"} label={t("english")} onPress={() => switchLanguage("en")} />
      </View>
    </View>
  );
}

function LangBtn({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={[st.langBtn, {
        backgroundColor: active ? BRAND.soft : "rgba(255,255,255,0.05)",
        borderColor: active ? "rgba(139,92,246,0.45)" : BORDER.subtle,
      }]}
    >
      <Text style={[st.langBtnTxt, { color: active ? BRAND.light : colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  langLabel: { ...typography.caption, fontFamily: FONT_FAMILY.medium, color: colors.textMuted, marginBottom: spacing.sm },
  langBtn: { flex: 1, paddingVertical: 11, borderRadius: RADIUS.md, alignItems: "center" as const, borderWidth: 1 },
  langBtnTxt: { ...typography.bodyBold, fontSize: 14, fontFamily: FONT_FAMILY.semibold },
});
