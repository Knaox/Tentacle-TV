import { Text } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import {
  PRESET_HINT_KEYS,
  PRESET_LABEL_KEYS,
  SELECTABLE_PRESETS,
  detectPreset,
  presetSettings,
} from "@tentacle-tv/shared";
import { SettingBlock, type Choice } from "./SettingBlock";
import { Colors } from "../../theme/colors";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande : UN choix.
 *
 * Le téléviseur alignait sept blocs de boutons — quatre passages, trois
 * bascules — à traverser au pavé directionnel. Le réglage fin n'a pas sa place
 * ici : il se fait sur ordinateur, il suit le COMPTE, et il s'applique donc
 * devant la télévision sans qu'on ait à le répéter.
 *
 * Des boutons, pas d'interrupteur (cf. `SettingBlock`) — celui qui est actif
 * se cerne de la teinte de marque.
 *
 * « Personnalisé » n'est pas proposé : c'est ce qu'on lit quand les réglages
 * viennent de l'ordinateur, et le toucher les remplacerait.
 */

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
