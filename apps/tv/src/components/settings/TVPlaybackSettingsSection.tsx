import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
} from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande : UN choix.
 *
 * Le téléviseur alignait sept blocs de boutons — quatre passages, trois
 * bascules — à traverser au pavé directionnel. Le réglage fin n'a pas sa place
 * ici : il se fait sur ordinateur, il suit le COMPTE, et il s'applique donc
 * devant la télévision sans qu'on ait à le répéter.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Des
 * boutons, comme la langue d'interface juste en dessous — celui qui est actif
 * se cerne de la teinte de marque.
 *
 * « Personnalisé » n'est pas proposé : c'est ce qu'on lit quand les réglages
 * viennent de l'ordinateur, et le toucher les remplacerait.
 */

interface Choice {
  value: string;
  label: string;
}

function SettingBlock({ title, hint, value, choices, onChoose }: {
  title: string;
  hint: string;
  value: string;
  choices: Choice[];
  onChoose: (value: string) => void;
}) {
  return (
    <View style={{ marginBottom: 36 }}>
      <Text style={{
        color: Colors.textTertiary, fontSize: 13, fontWeight: "600",
        letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 14,
      }}>
        {title}
      </Text>
      <Text style={{
        color: Colors.textTertiary, fontSize: 15, lineHeight: 22,
        maxWidth: 900, marginBottom: 14,
      }}>
        {hint}
      </Text>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {choices.map((c) => {
          const selected = value === c.value;
          return (
            <Focusable
              key={c.value}
              variant="button"
              focusRadius={Button.medium.borderRadius}
              scaleOverride={1.04}
              onPress={() => { onChoose(c.value); }}
              accessibilityLabel={c.label}
            >
              <View style={{
                minWidth: 160,
                alignItems: "center",
                ...Button.medium,
                borderWidth: 1,
                borderColor: selected ? brandAlpha(0.6) : Colors.glassBorder,
                backgroundColor: selected ? brandAlpha(0.18) : "transparent",
                paddingHorizontal: 18,
                paddingVertical: 12,
              }}>
                <Text style={{
                  color: selected ? Colors.accentPurpleLight : Colors.textPrimary,
                  fontSize: 17,
                  fontWeight: "600",
                }}>
                  {c.label}
                </Text>
              </View>
            </Focusable>
          );
        })}
      </View>
    </View>
  );
}

export function TVPlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const settings = useOwnPlaybackSettings();
  const preset = detectPreset(settings);

  // La liste vient de SELECTABLE_PRESETS, jamais d'un tableau écrit ici :
  // écrite à la main, elle avait déjà manqué l'ajout de « Par défaut ».
  const choices: Choice[] = [
    ...SELECTABLE_PRESETS.map((value) => ({ value, label: t(PRESET_LABEL_KEYS[value]) })),
    ...(preset === "custom" ? [{ value: "custom", label: t(PRESET_LABEL_KEYS.custom) }] : []),
  ];

  return (
    <>
      <SettingBlock
        title={t("playbackModeLabel")}
        hint={t(PRESET_HINT_KEYS[preset])}
        value={preset}
        choices={choices}
        onChoose={(value) => {
          const chosen = SELECTABLE_PRESETS.find((entry) => entry === value);
          if (chosen) setPlaybackSettings(presetSettings(chosen));
        }}
      />
      <Text style={{
        color: Colors.textTertiary, fontSize: 15, lineHeight: 22, maxWidth: 900,
      }}>
        {t("playbackAdvancedOnDesktop")}
      </Text>
    </>
  );
}
