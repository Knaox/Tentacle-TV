/**
 * Le réglage fin des passages (sous « Avancé ») et de l'épisode suivant
 * (`PlaybackSettingsSection`).
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
import type { PlaybackSettings, SegmentSettings, SkipLabelKey } from "@tentacle-tv/shared";
import { BeforeEndRules } from "./BeforeEndRules";
import { NextCountdownSlider } from "./NextCountdownSlider";
import { NextEpisodePreview } from "./NextEpisodePreview";
import { NextFinalCardPreview } from "./NextFinalCardPreview";
import { SegmentSettingsRow } from "./SegmentSettingsRow";
import { SegmentedChoice } from "./SegmentedChoice";
import { SettingsDisclosure } from "./SettingsDisclosure";
import { AdvancedFold } from "./wide/AdvancedFold";
import { SettingToggleRow } from "./SettingToggleRow";
import { SubSetting } from "./SubSetting";

/**
 * Dans l'ordre où les passages surviennent à l'écran, l'intro d'abord.
 *
 * Le générique de fin y figure DEUX FOIS — une pour les épisodes, une pour les
 * films. Ce ne sont pas deux façons de dire la même chose : sur un épisode, la
 * fiche « à suivre » occupe le générique et le bouton n'y paraît que s'il mène
 * ailleurs ; sur un film, « passer » veut dire rejoindre une scène
 * post-générique, ou terminer. Le film passe donc son générique tout seul
 * d'origine, l'épisode non.
 */
const PASSAGES: readonly {
  key: "intro" | "recap" | "outro" | "outroFilm" | "preview";
  apply: (patch: Partial<SegmentSettings>) => void;
}[] = [
  { key: "intro", apply: (intro) => { setPlaybackSettings({ intro }); } },
  { key: "recap", apply: (recap) => { setPlaybackSettings({ recap }); } },
  { key: "outro", apply: (outro) => { setPlaybackSettings({ outro }); } },
  { key: "outroFilm", apply: (outroFilm) => { setPlaybackSettings({ outroFilm }); } },
  { key: "preview", apply: (preview) => { setPlaybackSettings({ preview }); } },
];

const TITLE_KEYS = {
  intro: ["segmentIntroTitle", "segmentIntroHint"],
  recap: ["segmentRecapTitle", "segmentRecapHint"],
  outro: ["segmentOutroTitle", "segmentOutroHint"],
  outroFilm: ["segmentOutroFilmTitle", "segmentOutroFilmHint"],
  preview: ["segmentPreviewTitle", "segmentPreviewHint"],
} as const;

/**
 * Le libellé que porte le bouton pour chaque passage — celui du LECTEUR, pas
 * un texte de réglage. C'est ce qui fait de l'aperçu une promesse tenue.
 */
const PREVIEW_LABELS: Record<PassageKey, SkipLabelKey> = {
  intro: "skipIntro",
  recap: "skipRecap",
  outro: "skipCredits",
  // Le film montre le libellé qu'il porte VRAIMENT le plus souvent : « aller à
  // la scène ». C'est là que le réglage se joue — sur un générique sans rien
  // derrière, le bouton s'impose de lui-même et ne décompte jamais.
  outroFilm: "skipToPostCredits",
  preview: "skipPreview",
};

type PassageKey = (typeof PASSAGES)[number]["key"];

/** Les passages d'un épisode, un par un : passer seul, proposer, ou rien, et après combien de temps. */
export function SkipPassagesPanel({ settings }: { settings: PlaybackSettings }) {
  const { t } = useTranslation("preferences");
  return (
    <div>
      <div className="divide-y divide-line-subtle">
        {PASSAGES.map((passage) => (
          <div key={passage.key} className="py-5 first:pt-1">
            <SegmentSettingsRow
              fieldId={passage.key}
              title={t(TITLE_KEYS[passage.key][0])}
              hint={t(TITLE_KEYS[passage.key][1])}
              settings={settings[passage.key]}
              onChange={passage.apply}
              labelKey={PREVIEW_LABELS[passage.key]}
            />
          </div>
        ))}
      </div>

      {/* Le détail encombrait chaque réglage — trois lignes sous chacun, pour
          des cas qu'on ne rencontre qu'une fois. Il est ici, entier, pour qui
          le cherche : c'est la divulgation progressive, pas une amputation. */}
      <div className="border-t border-line-subtle pt-3">
        <SettingsDisclosure title={t("segmentsMoreTitle")}>
          <ul className="max-w-[62ch] space-y-2 text-[13px] leading-relaxed text-content-tertiary">
            <li>{t("segmentsMoreNothing")}</li>
            <li>{t("segmentsMoreDismiss")}</li>
            <li>{t("segmentsMoreOutro")}</li>
          </ul>
        </SettingsDisclosure>
      </div>
    </div>
  );
}

interface UpNextPanelProps {
  settings: PlaybackSettings;
  /** Le repli « Avancé » ouvert d'emblée (un réglage fin déjà touché, ou une ancre qui vise la ligne). */
  advancedOpen?: boolean;
}

/**
 * La fin d'un épisode. D'abord ce qu'on règle d'ordinaire — la fiche « à suivre », son
 * décompte, l'enchaînement, la durée —, avec leur aperçu ; puis, sous « Avancé », l'affiche de
 * fin, le moment où la fiche paraît et les règles par bibliothèque.
 */
export function UpNextPanel({ settings, advancedOpen = false }: UpNextPanelProps) {
  const { t } = useTranslation(["preferences", "settingsWeb"]);
  const next = settings.next;
  return (
    <div className="space-y-5">
      <SettingToggleRow
        title={t("upNextCardTitle")}
        hint={t("upNextCardHint")}
        active={next.nextCard}
        onChange={(nextCard) => { setPlaybackSettings({ next: { nextCard } }); }}
      />
      {/* Les trois réglages restent INDÉPENDANTS en écriture ; ils sont rangés sous la fiche
          dont ils dépendent à l'écran, et chacun dit pourquoi il est sans effet. */}
      <div className="space-y-5 rounded-tile bg-surface-2 p-4">
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
        <NextCountdownSlider
          valueMs={next.nextCountdownMs}
          disabled={!next.nextCountdown}
          onChange={(nextCountdownMs) => { setPlaybackSettings({ next: { nextCountdownMs } }); }}
        />
      </div>

      {/* Les trois réglages ci-dessus sont indépendants, et c'est ce qui se
          comprend mal en mots : ici on VOIT ce que chaque combinaison donne. */}
      <NextEpisodePreview next={next} />

      <AdvancedFold inset summary={t("settingsWeb:advanced.upNext")} defaultOpen={advancedOpen} openSignal={advancedOpen}>
        <div className="space-y-5">
          {/* L'affiche PLEIN ÉCRAN de fin — un quatrième réglage, indépendant
              des trois autres comme eux le sont entre eux : écarter la fiche du
              générique ne l'éteint pas, et c'est voulu. */}
          <SettingToggleRow
            title={t("upNextFinalCardTitle")}
            hint={t("upNextFinalCardHint")}
            active={next.nextFinalCard}
            onChange={(nextFinalCard) => { setPlaybackSettings({ next: { nextFinalCard } }); }}
          />
          <NextFinalCardPreview next={next} />

          <SubSetting
            title={t("upNextTriggerLabel")}
            hint={t("upNextTriggerHint")}
            trailing={(
              <SegmentedChoice
                label={t("upNextTriggerLabel")}
                value={next.nextTrigger}
                options={[
                  { value: "outroStart", label: t("upNextTriggerOutroStart") },
                  { value: "beforeEnd", label: t("upNextTriggerBeforeEnd") },
                ]}
                onChange={(nextTrigger) => { setPlaybackSettings({ next: { nextTrigger } }); }}
                className="max-w-full"
              />
            )}
          />

          <BeforeEndRules next={next} />
        </div>
      </AdvancedFold>
    </div>
  );
}
