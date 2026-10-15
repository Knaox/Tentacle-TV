import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  STILL_WATCHING_AFTER_CHOICES,
  STILL_WATCHING_COUNTDOWN_CHOICES,
  type StillWatchingChoice,
  type StillWatchingSettings,
} from "@tentacle-tv/shared";
import { Chip } from "../../controls/Chip";
import { SectionTitle, settingsText } from "./settingsParts";
import { ToggleRow } from "./ToggleRow";

/**
 * La section « Vous regardez encore ? » de l'onglet Lecture : la question
 * allumée ou non, puis — allumée seulement, régler le délai d'une question
 * éteinte n'a pas de sens — quand la poser et combien de temps laisser pour
 * répondre, en pastilles comme l'avance rapide. Réglage du COMPTE : réglé sur
 * la TV, il vaut aussi sur l'ordinateur et le téléphone. Les choix et leurs
 * mots sont ceux de tous les clients (`stillWatchingChoices.ts`, shared).
 * Absente face à un serveur qui ne déclare pas `playback.stillWatching`.
 */

type ChoiceKind = "after" | "countdown";

const ROWS: ReadonlyArray<{ kind: ChoiceKind; labelKey: string; choices: readonly StillWatchingChoice[] }> = [
  { kind: "after", labelKey: "stillWatchingAfter", choices: STILL_WATCHING_AFTER_CHOICES },
  { kind: "countdown", labelKey: "stillWatchingCountdown", choices: STILL_WATCHING_COUNTDOWN_CHOICES },
];

/** La clé de focus d'une pastille : `settings:stillWatchingAfter:<ms>`, `settings:stillWatchingCountdown:<ms>`. */
const chipKey = (kind: ChoiceKind, ms: number) =>
  `settings:stillWatching${kind === "after" ? "After" : "Countdown"}:${ms}`;

export const StillWatchingSection = memo(function StillWatchingSection({
  model,
  onChange,
}: {
  model: StillWatchingSettings;
  onChange?: (patch: Partial<StillWatchingSettings>) => void;
}) {
  const { t } = useTranslation(["preferences", "player"]);
  const selected: Record<ChoiceKind, number> = { after: model.afterMs, countdown: model.countdownMs };
  const choose = (kind: ChoiceKind, ms: number) =>
    onChange?.(kind === "after" ? { afterMs: ms } : { countdownMs: ms });
  return (
    <View>
      <SectionTitle title={t("player:stillWatching.title")} />
      <ToggleRow
        icon="eye"
        title={t("preferences:stillWatchingTitle")}
        description={t("preferences:stillWatchingHint")}
        value={model.enabled}
        onLabel={t("preferences:reglageActive")}
        offLabel={t("preferences:reglageDesactive")}
        focusKey="settings:stillWatching"
        onToggle={onChange ? (enabled) => onChange({ enabled }) : undefined}
      />
      {model.enabled
        ? ROWS.map((row) => (
          <View key={row.kind}>
            <Text style={[settingsText.label, styles.label]}>
              {t(`preferences:${row.labelKey}`)}
            </Text>
            <View style={styles.chips}>
              {row.choices.map(({ ms, label }) => (
                <Chip
                  key={ms}
                  label={label.count === undefined ? t(label.key) : t(label.key, { count: label.count })}
                  icon={selected[row.kind] === ms ? "check" : undefined}
                  selected={selected[row.kind] === ms}
                  focusKey={chipKey(row.kind, ms)}
                  onPress={onChange ? () => choose(row.kind, ms) : undefined}
                />
              ))}
            </View>
          </View>
        ))
        : null}
    </View>
  );
});

const styles = StyleSheet.create({
  label: { marginTop: 30, marginBottom: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
});
