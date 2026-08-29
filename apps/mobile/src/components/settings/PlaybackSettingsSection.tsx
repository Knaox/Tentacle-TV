import { View, Text, Switch, TextInput, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import {
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  type SegmentSettings,
} from "@tentacle-tv/shared";

import {
  spacing,
  typography,
  FONT_FAMILY,
  RADIUS,
  useTheme,
  useThemedStyles,
  type AppTheme,
} from "@/theme";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsSection } from "./SettingsSection";

/**
 * Ce que le lecteur a le droit de faire tout seul, sur téléphone.
 *
 * Mêmes réglages que sur le web et le téléviseur, et surtout le même MAGASIN :
 * ils suivent le compte, pas l'appareil. Le délai posé ici vaut devant la
 * télévision, où l'on ne saisit pas de nombre à la télécommande.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const theme = useTheme();
  const st = useThemedStyles(makeStyles);
  const reglages = usePlaybackSettings();
  const suivant = reglages.next;

  // Dans l'ordre où les passages surviennent à l'écran.
  const passages: {
    cle: string;
    titre: string;
    aide: string;
    etat: SegmentSettings;
    appliquer: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    { cle: "intro", titre: t("segmentIntroTitle"), aide: t("segmentIntroHint"), etat: reglages.intro,
      appliquer: (intro) => { setPlaybackSettings({ intro }); } },
    { cle: "recap", titre: t("segmentRecapTitle"), aide: t("segmentRecapHint"), etat: reglages.recap,
      appliquer: (recap) => { setPlaybackSettings({ recap }); } },
    { cle: "outro", titre: t("segmentOutroTitle"), aide: t("segmentOutroHint"), etat: reglages.outro,
      appliquer: (outro) => { setPlaybackSettings({ outro }); } },
    { cle: "preview", titre: t("segmentPreviewTitle"), aide: t("segmentPreviewHint"), etat: reglages.preview,
      appliquer: (preview) => { setPlaybackSettings({ preview }); } },
  ];

  const bascules: { cle: string; titre: string; aide: string; actif: boolean; poser: (v: boolean) => void }[] = [
    { cle: "carte", titre: t("upNextCardTitle"), aide: t("upNextCardHint"), actif: suivant.nextCard,
      poser: (nextCard) => { setPlaybackSettings({ next: { nextCard } }); } },
    { cle: "decompte", titre: t("upNextCountdownTitle"), aide: t("upNextCountdownHint"), actif: suivant.nextCountdown,
      poser: (nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); } },
    { cle: "auto", titre: t("upNextAutoPlayTitle"), aide: t("upNextAutoPlayHint"), actif: suivant.nextAutoPlay,
      poser: (nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); } },
  ];

  return (
    <>
      <SettingsSection
        title={t("playbackSegmentsTitle")}
        caption={`${t("playbackSegmentsHint")}\n${t("playbackSettingsAccount")}`}
      >
        {passages.map((passage, index) => (
          <SegmentSettingsRow
            key={passage.cle}
            titre={passage.titre}
            aide={passage.aide}
            reglages={passage.etat}
            onChange={passage.appliquer}
            last={index === passages.length - 1}
          />
        ))}
      </SettingsSection>

      <SettingsSection title={t("upNextTitle")}>
        {bascules.map((bascule) => (
          <View key={bascule.cle} style={st.bloc}>
            <View style={st.ligne}>
              <View style={st.texte}>
                <Text style={st.titre}>{bascule.titre}</Text>
                <Text style={st.aide}>{bascule.aide}</Text>
              </View>
              <Switch
                value={bascule.actif}
                onValueChange={bascule.poser}
                trackColor={{ false: theme.colors.fill.medium, true: theme.colors.brand.violet }}
                thumbColor={theme.colors.cta.brandFg}
                ios_backgroundColor={theme.colors.fill.medium}
                accessibilityLabel={bascule.titre}
              />
            </View>
          </View>
        ))}
        <View style={st.bloc}>
          <Text style={st.titre}>{t("upNextTriggerLabel")}</Text>
          <SegmentedChoice
            accessibilityLabel={t("upNextTriggerLabel")}
            value={suivant.nextTrigger}
            onChange={(nextTrigger) => {
              if (nextTrigger === "outroStart" || nextTrigger === "beforeEnd") {
                setPlaybackSettings({ next: { nextTrigger } });
              }
            }}
            options={[
              { value: "outroStart", label: t("upNextTriggerOutroStart") },
              { value: "beforeEnd", label: t("upNextTriggerBeforeEnd") },
            ]}
          />
        </View>
        <View style={[st.bloc, st.dernier]}>
          <View style={st.ligne}>
            <View style={st.texte}>
              <Text style={st.titre}>{t("upNextBeforeEndLabel")}</Text>
              <Text style={st.aide}>{t("upNextBeforeEndHint")}</Text>
            </View>
            <TextInput
              value={String(suivant.nextBeforeEndSeconds)}
              onChangeText={(texte) => {
                const saisi = Number.parseInt(texte, 10);
                if (!Number.isFinite(saisi)) return;
                const borne = Math.min(
                  NEXT_BEFORE_END_SECONDS_MAX,
                  Math.max(NEXT_BEFORE_END_SECONDS_MIN, saisi),
                );
                setPlaybackSettings({ next: { nextBeforeEndSeconds: borne } });
              }}
              keyboardType="number-pad"
              maxLength={3}
              style={st.champ}
              accessibilityLabel={t("upNextBeforeEndLabel")}
            />
          </View>
        </View>
      </SettingsSection>
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    bloc: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border.subtle,
      gap: spacing.sm,
    },
    dernier: { borderBottomWidth: 0 },
    ligne: { flexDirection: "row", alignItems: "center", gap: spacing.md },
    texte: { flex: 1 },
    titre: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
    aide: { ...typography.small, color: t.colors.text.tertiary, lineHeight: 17, marginTop: 2 },
    champ: {
      minWidth: 72,
      minHeight: 44,
      paddingHorizontal: spacing.sm,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border.subtle,
      backgroundColor: t.colors.fill.subtle,
      color: t.colors.text.primary,
      textAlign: "right",
      ...typography.body,
    },
  });
