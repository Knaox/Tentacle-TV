import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import {
  NEXT_BEFORE_END_SECONDS_MAX,
  NEXT_BEFORE_END_SECONDS_MIN,
  type SegmentSettings,
} from "@tentacle-tv/shared";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { CHAMP_REGLAGE, SettingToggleRow } from "./SettingToggleRow";

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
  const reglages = usePlaybackSettings();
  const suivant = reglages.next;

  // Dans l'ordre où les passages surviennent à l'écran, l'intro d'abord :
  // c'est le seul que le lecteur passe tout seul par défaut.
  const passages: {
    cle: string;
    titre: string;
    aide: string;
    reglages: SegmentSettings;
    appliquer: (patch: Partial<SegmentSettings>) => void;
  }[] = [
    {
      cle: "intro",
      titre: t("segmentIntroTitle"),
      aide: t("segmentIntroHint"),
      reglages: reglages.intro,
      appliquer: (intro) => { setPlaybackSettings({ intro }); },
    },
    {
      cle: "recap",
      titre: t("segmentRecapTitle"),
      aide: t("segmentRecapHint"),
      reglages: reglages.recap,
      appliquer: (recap) => { setPlaybackSettings({ recap }); },
    },
    {
      cle: "outro",
      titre: t("segmentOutroTitle"),
      aide: t("segmentOutroHint"),
      reglages: reglages.outro,
      appliquer: (outro) => { setPlaybackSettings({ outro }); },
    },
    {
      cle: "preview",
      titre: t("segmentPreviewTitle"),
      aide: t("segmentPreviewHint"),
      reglages: reglages.preview,
      appliquer: (preview) => { setPlaybackSettings({ preview }); },
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
          {passages.map((passage) => (
            <SegmentSettingsRow
              key={passage.cle}
              titre={passage.titre}
              aide={passage.aide}
              reglages={passage.reglages}
              onChange={passage.appliquer}
            />
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-line-subtle bg-fill-subtle p-5">
        <h3 className="mb-5 text-sm font-semibold text-content-primary">{t("upNextTitle")}</h3>
        <div className="space-y-5">
          <SettingToggleRow
            titre={t("upNextCardTitle")}
            aide={t("upNextCardHint")}
            actif={suivant.nextCard}
            onChange={(nextCard) => { setPlaybackSettings({ next: { nextCard } }); }}
          />
          <SettingToggleRow
            titre={t("upNextCountdownTitle")}
            aide={t("upNextCountdownHint")}
            actif={suivant.nextCountdown}
            onChange={(nextCountdown) => { setPlaybackSettings({ next: { nextCountdown } }); }}
          />
          <SettingToggleRow
            titre={t("upNextAutoPlayTitle")}
            aide={t("upNextAutoPlayHint")}
            actif={suivant.nextAutoPlay}
            onChange={(nextAutoPlay) => { setPlaybackSettings({ next: { nextAutoPlay } }); }}
          />
          <div>
            <label htmlFor="declencheur-suite" className="text-sm font-medium text-content-primary">
              {t("upNextTriggerLabel")}
            </label>
            <select
              id="declencheur-suite"
              value={suivant.nextTrigger}
              onChange={(e) => {
                const nextTrigger = e.target.value;
                if (nextTrigger === "outroStart" || nextTrigger === "beforeEnd") {
                  setPlaybackSettings({ next: { nextTrigger } });
                }
              }}
              className={`mt-2 w-full max-w-xs ${CHAMP_REGLAGE}`}
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
              value={suivant.nextBeforeEndSeconds}
              onChange={(e) => {
                const saisi = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(saisi)) {
                  setPlaybackSettings({ next: { nextBeforeEndSeconds: saisi } });
                }
              }}
              className={`mt-2 w-32 ${CHAMP_REGLAGE}`}
            />
          </div>
        </div>
      </div>
    </>
  );
}
