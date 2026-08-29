import { useTranslation } from "react-i18next";
import { setPlaybackSettings, useOwnPlaybackSettings } from "@tentacle-tv/api-client";
import { detectPreset, presetSettings } from "@tentacle-tv/shared";

/**
 * Ce que le lecteur a le droit de faire tout seul, à la télécommande : UN choix.
 *
 * Sept sections de boutons se traversaient au pavé directionnel — quatre
 * passages, trois bascules. Le réglage fin n'a pas sa place ici : il se fait
 * sur ordinateur, il suit le COMPTE (`playback_settings`), et il s'applique
 * donc sur cette dalle sans qu'on ait à le répéter. Un réglage changé ici est
 * su du lecteur dans la seconde, et vaut sur les autres appareils du foyer.
 *
 * Des boutons plutôt qu'un interrupteur : un pouce qui coulisse ne veut rien
 * dire sur une dalle. Même grammaire que la langue d'interface, juste au-dessus.
 *
 * « Personnalisé » n'est pas proposé : c'est ce qu'on lit quand les réglages
 * viennent de l'ordinateur, et le toucher les remplacerait.
 */

interface Choice {
  value: string;
  label: string;
}

interface SectionProps {
  title: string;
  hint: string;
  value: string;
  choice: Choice[];
  onChoose: (value: string) => void;
}

function SettingSection({ title, hint, value, choice, onChoose }: SectionProps) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
        {title}
      </h2>
      <p className="mb-4 max-w-3xl text-[15px] leading-relaxed text-content-tertiary">{hint}</p>
      <div className="flex gap-4">
        {choice.map((c) => (
          <button
            key={c.value}
            type="button"
            className="bouton-reglage-tv"
            data-actif={value === c.value}
            onClick={() => onChoose(c.value)}
          >
            <span className="bouton-reglage-tv-valeur">{c.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function PlaybackSettingsTv() {
  const { t } = useTranslation("preferences");
  // Les réglages PROPRES : dans un groupe Watch Together, ceux de l'hôte
  // gouvernent la lecture, mais ce sont bien les siens qu'on règle ici.
  const preset = detectPreset(useOwnPlaybackSettings());

  const choices: Choice[] = [
    { value: "manual", label: t("playbackModeManual") },
    { value: "automatic", label: t("playbackModeAutomatic") },
    ...(preset === "custom" ? [{ value: "custom", label: t("playbackModeCustom") }] : []),
  ];

  const hint =
    preset === "manual"
      ? "playbackModeManualHint"
      : preset === "automatic"
        ? "playbackModeAutomaticHint"
        : "playbackModeCustomHint";

  return (
    <>
      <SettingSection
        title={t("playbackModeLabel")}
        hint={t(hint)}
        value={preset}
        choice={choices}
        onChoose={(value) => {
          if (value === "manual" || value === "automatic") {
            setPlaybackSettings(presetSettings(value));
          }
        }}
      />
      <p className="mb-12 max-w-3xl text-[15px] leading-relaxed text-content-tertiary">
        {t("playbackAdvancedOnDesktop")}
      </p>
    </>
  );
}
