/**
 * Le réglage fin, replié.
 *
 * Tout ce qui suit était déployé d'emblée : quatre passages × trois contrôles,
 * plus cinq réglages d'épisode suivant. Le détail est utile — il l'est même
 * beaucoup, une fois qu'on sait ce qu'on cherche — mais le poser devant
 * quelqu'un qui voulait juste « passe-moi les intros » lui demande de trier
 * vingt contrôles pour en trouver un.
 *
 * Chaque groupe est un REPLI, fermé par défaut : déverser vingt contrôles
 * d'un coup forme un mur, et un mur ne se lit pas. Fermé, chaque groupe
 * redevient une phrase qu'on ouvre quand on la cherche.
 *
 * Les trois réglages de fin d'épisode restent STRICTEMENT indépendants en
 * écriture : couper le décompte ne doit pas masquer la fiche, c'est le bug
 * historique que cette structure interdit. Ils sont en revanche INDENTÉS l'un
 * sous l'autre et disent pourquoi ils sont sans effet, ce qui est une question
 * de lisibilité — pas de couplage.
 */

import { useTranslation } from "react-i18next";
import { setPlaybackSettings } from "@tentacle-tv/api-client";
import type { PlaybackSettings, SegmentSettings } from "@tentacle-tv/shared";
import { BeforeEndRules } from "./BeforeEndRules";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsDisclosure } from "./SettingsDisclosure";
import { SettingToggleRow } from "./SettingToggleRow";

/** Dans l'ordre où les passages surviennent à l'écran, l'intro d'abord. */
const PASSAGES: readonly {
  key: "intro" | "recap" | "outro" | "preview";
  apply: (patch: Partial<SegmentSettings>) => void;
}[] = [
  { key: "intro", apply: (intro) => { setPlaybackSettings({ intro }); } },
  { key: "recap", apply: (recap) => { setPlaybackSettings({ recap }); } },
  { key: "outro", apply: (outro) => { setPlaybackSettings({ outro }); } },
  { key: "preview", apply: (preview) => { setPlaybackSettings({ preview }); } },
];

const TITLE_KEYS = {
  intro: ["segmentIntroTitle", "segmentIntroHint"],
  recap: ["segmentRecapTitle", "segmentRecapHint"],
  outro: ["segmentOutroTitle", "segmentOutroHint"],
  preview: ["segmentPreviewTitle", "segmentPreviewHint"],
} as const;

export function PlaybackAdvancedPanel({ settings }: { settings: PlaybackSettings }) {
  const { t } = useTranslation("preferences");
  const next = settings.next;

  return (
    <div className="space-y-6">
      <SettingsDisclosure
        title={t("playbackSegmentsTitle")}
        summary={t("playbackSegmentsSummary")}
      >
        <p className="text-xs leading-relaxed text-content-tertiary">
          {t("playbackSegmentsHint")}
        </p>
        <div className="mt-5 space-y-6">
          {PASSAGES.map((passage) => (
            <SegmentSettingsRow
              key={passage.key}
              fieldId={passage.key}
              title={t(TITLE_KEYS[passage.key][0])}
              hint={t(TITLE_KEYS[passage.key][1])}
              settings={settings[passage.key]}
              onChange={passage.apply}
            />
          ))}
        </div>
      </SettingsDisclosure>

      <SettingsDisclosure title={t("upNextTitle")} summary={t("upNextSummary")}>
        <div className="space-y-5">
          <SettingToggleRow
            title={t("upNextCardTitle")}
            hint={t("upNextCardHint")}
            active={next.nextCard}
            onChange={(nextCard) => { setPlaybackSettings({ next: { nextCard } }); }}
          />
          <div className="space-y-5 border-l border-line-subtle pl-4">
            <SettingToggleRow
              title={t("upNextCountdownTitle")}
              hint={next.nextCard ? t("upNextCountdownHint") : t("upNextNeedsCard")}
              active={next.nextCountdown}
              onChange={(nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); }}
            />
            <SettingToggleRow
              title={t("upNextAutoPlayTitle")}
              hint={next.nextCountdown ? t("upNextAutoPlayHint") : t("upNextNeedsCountdown")}
              active={next.nextAutoPlay}
              onChange={(nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); }}
            />
          </div>

          <div>
            <p className="text-sm font-medium text-content-primary">{t("upNextTriggerLabel")}</p>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {t("upNextTriggerHint")}
            </p>
            <SegmentedChoice
              label={t("upNextTriggerLabel")}
              value={next.nextTrigger}
              options={[
                { value: "outroStart", label: t("upNextTriggerOutroStart") },
                { value: "beforeEnd", label: t("upNextTriggerBeforeEnd") },
              ]}
              onChange={(nextTrigger) => { setPlaybackSettings({ next: { nextTrigger } }); }}
              className="mt-3 max-w-full"
            />
          </div>

          <BeforeEndRules next={next} />
        </div>
      </SettingsDisclosure>
    </div>
  );
}
