import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import {
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  type SegmentSettings,
} from "@tentacle-tv/shared";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { SETTING_FIELD, SettingToggleRow } from "./SettingToggleRow";

/**
 * Tout ce que le lecteur a le droit de faire tout seul, en un seul endroit.
 *
 * Deux blocs : les PASSAGES d'un épisode (ce que le serveur signale — début,
 * résumé, générique de fin, aperçu) et la FIN d'un épisode. Ils étaient
 * dispersés en trois bascules d'appareil ; ils suivent désormais le compte
 * (`playback_settings`), et le lecteur les lit tous par le même arbitre.
 *
 * Les trois réglages de fin d'épisode sont STRICTEMENT indépendants : montrer
 * la fiche, décompter, enchaîner. L'intrication historique — couper le
 * décompte masquait la fiche — est précisément le bug que cette forme
 * interdit. Leur ordre les explique : chacun n'a d'effet qu'avec le précédent,
 * et l'aide le dit.
 */
export function PlaybackSettingsSection() {
  const { t } = useTranslation("preferences");
  const settings = usePlaybackSettings();
  const next = settings.next;

  // Dans l'ordre où les passages surviennent à l'écran, l'intro d'abord :
  // c'est le seul que le lecteur passe tout seul par défaut.
  const segments: {
    key: string;
    title: string;
    hint: string;
    settings: SegmentSettings;
    apply: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    {
      key: "intro",
      title: t("segmentIntroTitle"),
      hint: t("segmentIntroHint"),
      settings: settings.intro,
      apply: (intro) => { setPlaybackSettings({ intro }); },
    },
    {
      key: "recap",
      title: t("segmentRecapTitle"),
      hint: t("segmentRecapHint"),
      settings: settings.recap,
      apply: (recap) => { setPlaybackSettings({ recap }); },
    },
    {
      key: "outro",
      title: t("segmentOutroTitle"),
      hint: t("segmentOutroHint"),
      settings: settings.outro,
      apply: (outro) => { setPlaybackSettings({ outro }); },
    },
    {
      key: "preview",
      title: t("segmentPreviewTitle"),
      hint: t("segmentPreviewHint"),
      settings: settings.preview,
      apply: (preview) => { setPlaybackSettings({ preview }); },
    },
  ];

  return (
    <>
      <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
        <h3 className="text-sm font-semibold text-content-primary">
          {t("playbackSegmentsTitle")}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {t("playbackSegmentsHint")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-content-quaternary">
          {t("playbackSettingsAccount")}
        </p>
        <div className="mt-5 space-y-6">
          {segments.map((passage) => (
            <SegmentSettingsRow
              key={passage.key}
              title={passage.title}
              hint={passage.hint}
              settings={passage.settings}
              onChange={passage.apply}
            />
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
        <h3 className="mb-5 text-sm font-semibold text-content-primary">{t("upNextTitle")}</h3>
        <div className="space-y-5">
          <SettingToggleRow
            title={t("upNextCardTitle")}
            hint={t("upNextCardHint")}
            active={next.nextCard}
            onChange={(nextCard) => { setPlaybackSettings({ next: { nextCard } }); }}
          />
          <SettingToggleRow
            title={t("upNextCountdownTitle")}
            hint={t("upNextCountdownHint")}
            active={next.nextCountdown}
            onChange={(nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); }}
          />
          <SettingToggleRow
            title={t("upNextAutoPlayTitle")}
            hint={t("upNextAutoPlayHint")}
            active={next.nextAutoPlay}
            onChange={(nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); }}
          />
          <div>
            <label htmlFor="declencheur-suite" className="text-sm font-medium text-content-primary">
              {t("upNextTriggerLabel")}
            </label>
            <select
              id="declencheur-suite"
              value={next.nextTrigger}
              onChange={(e) => {
                const nextTrigger = e.target.value;
                if (nextTrigger === "outroStart" || nextTrigger === "beforeEnd") {
                  setPlaybackSettings({ next: { nextTrigger } });
                }
              }}
              className={`mt-2 w-full max-w-xs ${SETTING_FIELD}`}
            >
              <option value="outroStart">{t("upNextTriggerOutroStart")}</option>
              <option value="beforeEnd">{t("upNextTriggerBeforeEnd")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="avant-fin" className="text-sm font-medium text-content-primary">
              {t("upNextBeforeEndLabel")}
            </label>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {t("upNextBeforeEndHint")}
            </p>
            <input
              id="avant-fin"
              type="number"
              min={NEXT_BEFORE_END_SECONDS_MIN}
              max={NEXT_BEFORE_END_SECONDS_MAX}
              step={5}
              value={next.nextBeforeEndSeconds}
              onChange={(e) => {
                const typed = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(typed)) {
                  setPlaybackSettings({ next: { nextBeforeEndSeconds: typed } });
                }
              }}
              className={`mt-2 w-32 ${SETTING_FIELD}`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
