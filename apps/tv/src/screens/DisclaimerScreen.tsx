import { useState, useCallback } from "react";
import { View, Text, ScrollView, TVFocusGuideView } from "react-native";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { useTentacleConfig } from "@tentacle-tv/api-client";
import { useTranslation } from "react-i18next";
import { i18n } from "@tentacle-tv/shared";
import { Colors } from "../theme/colors";
import { Focusable } from "../components/focus/Focusable";
import { TentacleLogo } from "../components/icons/TentacleLogo";
import { CheckIcon } from "../components/icons/TVIcons";
import { styles } from "./DisclaimerScreen.styles";
import { Bouton } from "../theme/boutons";

const LANGS = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
] as const;

export function DisclaimerScreen() {
  const { t } = useTranslation("disclaimer");
  const navigation = useNavigation();
  const { storage } = useTentacleConfig();
  const [checked, setChecked] = useState(false);
  const [refusOuvert, setRefusOuvert] = useState(false);
  const [lang, setLang] = useState(() => {
    const saved = storage.getItem("tentacle_language");
    return saved?.startsWith("fr") ? "fr" : "en";
  });

  const switchLang = useCallback((code: string) => {
    i18n.changeLanguage(code);
    storage.setItem("tentacle_language", code);
    setLang(code);
  }, [storage]);

  const handleAccept = useCallback(() => {
    storage.setItem("disclaimer_accepted", "true");
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "PairCode" as never }] }),
    );
  }, [storage, navigation]);

  const handleDecline = useCallback(() => {
    setRefusOuvert(true);
  }, []);

  return (
    <View style={styles.root}>
      {/* @ts-expect-error — TVFocusGuideView (react-native-tvos) : fluidifie la nav
          verticale à travers le bloc de texte non-focusable. */}
      <TVFocusGuideView style={styles.card} autoFocus>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <TentacleLogo size={44} />
          <Text style={styles.appName}>TENTACLE TV</Text>
        </View>

        {/* Language switcher */}
        <View style={styles.langRow}>
          {LANGS.map((l) => (
            <Focusable key={l.code} variant="button" focusRadius={Bouton.moyen.borderRadius} onPress={() => switchLang(l.code)}>
              <View style={[styles.langButton, lang === l.code && styles.langButtonActive]}>
                <Text style={[styles.langText, lang === l.code && styles.langTextActive]}>{l.label}</Text>
              </View>
            </Focusable>
          ))}
        </View>

        {/* Title */}
        <Text style={styles.title}>{t("title")}</Text>
        <Text style={styles.heading}>{t("heading")}</Text>

        {/* Glass body */}
        <View style={styles.glassContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>{t("body")}</Text>
          </ScrollView>
        </View>

        {/* Checkbox — focus initial (action principale, atteignable d'emblée) */}
        <Focusable
          variant="button"
          focusRadius={Bouton.moyen.borderRadius}
          onPress={() => setChecked((v) => !v)}
          accessibilityLabel={t("checkboxLabel")}
          hasTVPreferredFocus
        >
          <View style={styles.checkboxRow}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <CheckIcon size={16} color={Colors.accentPurpleLight} />}
            </View>
            <Text style={styles.checkboxLabel}>{t("checkboxLabel")}</Text>
          </View>
        </Focusable>

        {/* Buttons (empilés, pleine largeur) */}
        <View style={styles.buttonsCol}>
          <Focusable
            variant="button"
            onPress={checked ? handleAccept : undefined}
            focusRadius={Bouton.grand.borderRadius}
            hasTVPreferredFocus={false}
          >
            <View style={[styles.acceptButton, !checked && styles.acceptButtonDisabled]}>
              <Text style={styles.acceptText}>{t("accept")}</Text>
            </View>
          </Focusable>

          <Focusable variant="button" onPress={handleDecline} focusRadius={Bouton.grand.borderRadius}>
            <View style={styles.declineButton}>
              <Text style={styles.declineText}>{t("decline")}</Text>
            </View>
          </Focusable>
        </View>
      </TVFocusGuideView>

      {refusOuvert && (
        /* @ts-expect-error — TVFocusGuideView (react-native-tvos) : autoFocus pose
           le focus sur le bouton, les trapFocus* empechent d'en sortir. */
        <TVFocusGuideView
          style={styles.overlay}
          autoFocus
          trapFocusUp
          trapFocusDown
          trapFocusLeft
          trapFocusRight
        >
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t("declineTitle")}</Text>
            <Text style={styles.dialogMessage}>{t("declineMessage")}</Text>
            <Focusable
              variant="button"
              focusRadius={Bouton.grand.borderRadius}
              onPress={() => setRefusOuvert(false)}
              hasTVPreferredFocus
            >
              <View style={styles.acceptButton}>
                <Text style={styles.acceptText}>OK</Text>
              </View>
            </Focusable>
          </View>
        </TVFocusGuideView>
      )}
    </View>
  );
}
