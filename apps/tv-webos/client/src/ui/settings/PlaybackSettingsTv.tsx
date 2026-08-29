import { useTranslation } from "react-i18next";
import { setPlaybackSettings, usePlaybackSettings } from "@tentacle-tv/api-client";
import type { SegmentAction, SegmentSettings } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande.
 *
 * Des boutons plutôt qu'un interrupteur : un pouce qui coulisse ne veut rien
 * dire sur une dalle. Même grammaire que la langue d'interface, juste au-dessus.
 *
 * Les réglages viennent du magasin de COMPTE (`playback_settings`), le même que
 * lisent les surcouches du lecteur sur cette cible : un réglage changé ici est
 * su du lecteur dans la seconde, et vaut sur les autres appareils du foyer.
 *
 * Le DÉLAI du saut automatique n'est pas offert ici, à dessein : saisir un
 * nombre à la télécommande est une punition, et le réglage suit le compte —
 * il se pose une fois depuis un ordinateur ou un téléphone, et il vaut pour la
 * télévision. Extrait de `PlaybackScreenTv` pour tenir les 300 lignes.
 */

interface Choice {
  value: string;
  label: string;
}

interface SectionProps {
  title: string;
  aide: string;
  value: string;
  choice: Choice[];
  onChoose: (value: string) => void;
}

function SettingSection({ title, aide, value, choice, onChoose }: SectionProps) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
        {title}
      </h2>
      <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-content-tertiary">{aide}</p>
      <div className="flex gap-4">
        {choice.map((c) => (
          <button
            key={c.value}
            type="button"
            className="bouton-reglage-tv"
            data-active={value === c.value}
            onClick={() => onChoose(c.value)}
          >
            <span className="bouton-reglage-tv-valeur">{c.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function estAction(value: string): value is SegmentAction {
  return value === "button" || value === "auto" || value === "off";
}

/**
 * Les passages d'un épisode, puis sa fin — dans l'ordre où ils surviennent.
 * Les trois réglages de fin restent STRICTEMENT indépendants : montrer la
 * fiche, décompter, enchaîner.
 */
export function PlaybackSettingsTv() {
  const { t } = useTranslation("preferences");
  const settings = usePlaybackSettings();

  const actions: Choice[] = [
    { value: "button", label: t("segmentActionButton") },
    { value: "auto", label: t("segmentActionAuto") },
    { value: "off", label: t("segmentActionOff") },
  ];
  const ouiNon: Choice[] = [
    { value: "oui", label: t("reglageActive") },
    { value: "non", label: t("reglageDesactive") },
  ];

  const segments: { key: string; title: string; aide: string; state: SegmentSettings;
    apply: (patch: Partial<SegmentSettings>) => void }[] = [
    {
      key: "intro",
      title: t("segmentIntroTitle"),
      aide: t("segmentIntroHint"),
      state: settings.intro,
      apply: (intro) => { setPlaybackSettings({ intro }); },
    },
    {
      key: "recap",
      title: t("segmentRecapTitle"),
      aide: t("segmentRecapHint"),
      state: settings.recap,
      apply: (recap) => { setPlaybackSettings({ recap }); },
    },
    {
      key: "outro",
      title: t("segmentOutroTitle"),
      aide: t("segmentOutroHint"),
      state: settings.outro,
      apply: (outro) => { setPlaybackSettings({ outro }); },
    },
    {
      key: "preview",
      title: t("segmentPreviewTitle"),
      aide: t("segmentPreviewHint"),
      state: settings.preview,
      apply: (preview) => { setPlaybackSettings({ preview }); },
    },
  ];

  const next = settings.next;

  return (
    <>
      {segments.map((passage) => (
        <SettingSection
          key={passage.key}
          title={passage.title}
          aide={passage.aide}
          value={passage.state.action}
          choice={actions}
          onChoose={(value) => {
            if (estAction(value)) passage.apply({ action: value });
          }}
        />
      ))}
      <SettingSection
        title={t("upNextCardTitle")}
        aide={t("upNextCardHint")}
        value={next.nextCard ? "oui" : "non"}
        choice={ouiNon}
        onChoose={(value) => { setPlaybackSettings({ next: { nextCard: value === "oui" } }); }}
      />
      <SettingSection
        title={t("upNextCountdownTitle")}
        aide={t("upNextCountdownHint")}
        value={next.nextCountdown ? "oui" : "non"}
        choice={ouiNon}
        onChoose={(value) => {
          setPlaybackSettings({ next: { nextCountdown: value === "oui" } });
        }}
      />
      <SettingSection
        title={t("upNextAutoPlayTitle")}
        aide={t("upNextAutoPlayHint")}
        value={next.nextAutoPlay ? "oui" : "non"}
        choice={ouiNon}
        onChoose={(value) => {
          setPlaybackSettings({ next: { nextAutoPlay: value === "oui" } });
        }}
      />
    </>
  );
}
