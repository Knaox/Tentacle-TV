import { useEffect, useState } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { isVigieRecoAvailable, useResetTasteProfile, useSaveRecoSettingsPatch } from "@tentacle-tv/api-client";
import type { RecoSettingsData } from "@tentacle-tv/api-client";
import { BrandSwitch, SettingsSection, SettingsRow, SteppedSlider } from "@/components/settings";
import { useActivePlugins } from "@/hooks/useActivePlugins";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { spacing, typography, FONT_FAMILY, useThemedStyles, type AppTheme } from "@/theme";

const BALANCE_SAVE_MS = 300;

type ToggleKey = "personalized" | "includeVigie" | "community" | "shareHistory";
const TOGGLES: ReadonlyArray<{ key: ToggleKey; icon: "user" | "compass" | "users" | "eye"; label: string; hint: string }> = [
  { key: "personalized", icon: "user", label: "persoRecoPersonalized", hint: "persoRecoPersonalizedHint" },
  { key: "includeVigie", icon: "compass", label: "persoRecoVigie", hint: "persoRecoVigieHint" },
  { key: "community", icon: "users", label: "persoRecoCommunity", hint: "persoRecoCommunityHint" },
  { key: "shareHistory", icon: "eye", label: "persoRecoShareHistory", hint: "persoRecoShareHistoryHint" },
];

/**
 * Section « Recommandations » : les quatre interrupteurs, l'équilibre des
 * suggestions (0 = Aventureux … 100 = Sûr, par crans de 10, sauvegardé au
 * relâcher) et la remise à zéro du profil, confirmée.
 */
export function PersonalizationRecoSection({ settings }: { settings: RecoSettingsData }) {
  const { t } = useTranslation("preferences");
  const { t: tc } = useTranslation("common");
  const st = useThemedStyles(makeStyles);
  const save = useSaveRecoSettingsPatch();
  const reset = useResetTasteProfile();
  // « Hors bibliothèque » n'a de sens que si CE serveur sait servir du hors
  // bibliothèque : il le dit lui-même (`vigieAvailable`), avec le terme exact
  // du moteur — plugin installé, activé, intégration allumée ET configurée.
  // La liste des plugins ne reste que le repli des serveurs d'avant ce champ.
  const { data: plugins } = useActivePlugins();
  const vigie = isVigieRecoAvailable(settings.vigieAvailable, plugins);
  const toggles = TOGGLES.filter((toggle) => toggle.key !== "includeVigie" || vigie);

  // Le curseur garde un état local pendant le geste ; le compte suit après.
  // Tant qu'une sauvegarde attend ou vole, le serveur ne dicte rien : le
  // rafraîchissement d'une sauvegarde précédente ramènerait sinon l'ancienne
  // valeur sous le doigt (mesuré : deux appuis rapprochés, le second effacé).
  const [balance, setBalance] = useState(settings.explorationBalance);
  const saveBalance = useDebouncedCallback((value: number) => save.mutate({ explorationBalance: value }), BALANCE_SAVE_MS);
  useEffect(() => {
    if (!save.isPending && !saveBalance.isPending()) setBalance(settings.explorationBalance);
  }, [settings.explorationBalance, save.isPending, saveBalance]);

  const confirmReset = () => {
    Alert.alert(t("persoResetProfile"), t("persoResetProfileBody"), [
      { text: tc("cancel"), style: "cancel" },
      { text: t("persoResetProfileConfirm"), style: "destructive", onPress: () => reset.mutate() },
    ]);
  };

  return (
    <SettingsSection title={t("persoRecoTitle")} caption={t("persoRecoCaption")}>
      {toggles.map(({ key, icon, label, hint }) => (
        <SettingsRow
          key={key}
          icon={icon}
          label={t(label)}
          description={t(hint)}
          trailing={
            <BrandSwitch
              value={settings[key]}
              onValueChange={(next) => save.mutate({ [key]: next })}
              accessibilityLabel={t(label)}
            />
          }
        />
      ))}
      <View style={st.block}>
        <Text style={st.label}>{t("persoBalance")}</Text>
        <Text style={st.hint}>{t("persoBalanceHint")}</Text>
        <SteppedSlider
          value={balance}
          min={0}
          max={100}
          step={10}
          onChange={setBalance}
          onChangeEnd={(value) => saveBalance.call(value)}
          accessibilityLabel={t("persoBalance")}
          valueText={t("persoBalanceValue", { value: balance })}
          leftLabel={t("persoBalanceAdventurous")}
          rightLabel={t("persoBalanceSafe")}
        />
      </View>
      <SettingsRow icon="rotate-ccw" label={t("persoResetProfile")} destructive last disabled={reset.isPending} onPress={confirmReset} />
    </SettingsSection>
  );
}

const makeStyles = (t: AppTheme) => StyleSheet.create({
  block: { padding: spacing.md, gap: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border.subtle },
  label: { ...typography.body, fontFamily: FONT_FAMILY.semibold, color: t.colors.text.primary },
  hint: { ...typography.caption, color: t.colors.text.tertiary, marginBottom: spacing.sm },
});
