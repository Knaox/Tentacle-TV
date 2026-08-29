import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import type { SegmentAction, SegmentSettings } from "@tentacle-tv/shared";
import { Focusable } from "../focus/Focusable";
import { Colors, brandAlpha } from "../../theme/colors";
import { Button } from "../../theme/buttons";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande.
 *
 * Pas d'interrupteur à glissière : il n'en existe aucun dans l'application, et
 * un pouce qui coulisse ne veut rien dire sans doigt pour le pousser. Des
 * boutons, comme la langue d'interface juste en dessous — celui qui est actif
 * se cerne de la teinte de marque.
 *
 * Les réglages viennent du magasin de COMPTE, le même que lisent les surcouches
 * du lecteur : un choix posé ici vaut sur le téléphone, et réciproquement. Le
 * DÉLAI du saut automatique n'est pas offert ici, à dessein — saisir un nombre
 * à la télécommande est une punition, et le réglage suit le compte.
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

function isAction(value: string): value is SegmentAction {
  return value === "button" || value === "auto" || value === "off";
}

export function TVPlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const settings = usePlaybackSettings();
  const next = settings.next;

  const actions: Choice[] = [
    { value: "button", label: t("segmentActionButton") },
    { value: "auto", label: t("segmentActionAuto") },
    { value: "off", label: t("segmentActionOff") },
  ];
  const yesNo: Choice[] = [
    { value: "oui", label: t("reglageActive") },
    { value: "non", label: t("reglageDesactive") },
  ];

  const segments: {
    key: string; title: string; hint: string; state: SegmentSettings;
    apply: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    { key: "intro", title: t("segmentIntroTitle"), hint: t("segmentIntroHint"), state: settings.intro,
      apply: (intro) => { setPlaybackSettings({ intro }); } },
    { key: "recap", title: t("segmentRecapTitle"), hint: t("segmentRecapHint"), state: settings.recap,
      apply: (recap) => { setPlaybackSettings({ recap }); } },
    { key: "outro", title: t("segmentOutroTitle"), hint: t("segmentOutroHint"), state: settings.outro,
      apply: (outro) => { setPlaybackSettings({ outro }); } },
    { key: "preview", title: t("segmentPreviewTitle"), hint: t("segmentPreviewHint"), state: settings.preview,
      apply: (preview) => { setPlaybackSettings({ preview }); } },
  ];

  const toggles: { key: string; title: string; hint: string; active: boolean; set: (v: boolean) => void }[] = [
    { key: "carte", title: t("upNextCardTitle"), hint: t("upNextCardHint"), active: next.nextCard,
      set: (nextCard) => { setPlaybackSettings({ next: { nextCard } }); } },
    { key: "decompte", title: t("upNextCountdownTitle"), hint: t("upNextCountdownHint"), active: next.nextCountdown,
      set: (nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); } },
    { key: "auto", title: t("upNextAutoPlayTitle"), hint: t("upNextAutoPlayHint"), active: next.nextAutoPlay,
      set: (nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); } },
  ];

  return (
    <>
      {segments.map((segment) => (
        <SettingBlock
          key={segment.key}
          title={segment.title}
          hint={segment.hint}
          value={segment.state.action}
          choices={actions}
          onChoose={(value) => { if (isAction(value)) segment.apply({ action: value }); }}
        />
      ))}
      {toggles.map((toggle) => (
        <SettingBlock
          key={toggle.key}
          title={toggle.title}
          hint={toggle.hint}
          value={toggle.active ? "oui" : "non"}
          choices={yesNo}
          onChoose={(value) => { toggle.set(value === "oui"); }}
        />
      ))}
    </>
  );
}
