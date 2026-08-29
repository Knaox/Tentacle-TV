/**
 * « Combien de temps avant la fin » — facultatif, et par bibliothèque.
 *
 * # Pourquoi ce n'est pas un nombre
 *
 * Ce réglage ne sert que là où Jellyfin n'a signalé AUCUN générique : c'est le
 * seul cas où le lecteur doit deviner quand proposer la suite. Or la queue
 * d'un fichier n'a pas la même longueur selon ce qu'on regarde — une série
 * d'une heure et un animé de vingt-trois minutes ne se ressemblent pas. Un
 * nombre unique se trompe donc forcément sur l'un des deux.
 *
 * D'où deux niveaux : un seuil global — 98 % du média, qui vaut pour les deux
 * formats sans qu'on ait rien à dire — et des règles ciblées, chacune sur ses
 * bibliothèques, en proportion ou en secondes.
 *
 * # Pourquoi il est facultatif
 *
 * Éteint, la fin d'un épisode sans générique signalé reste NUE : aucune fiche
 * ne paraît. C'est une demande, et elle se tient — mieux vaut rien qu'une
 * fiche posée au hasard sur la dernière scène.
 */

import { useTranslation } from "react-i18next";
import { setPlaybackSettings } from "@tentacle-tv/api-client";
import {
  BEFORE_END_MAX_RULES,
  type BeforeEndRule,
  type NextEpisodeSettings,
} from "@tentacle-tv/shared";
import { BeforeEndTargetFields } from "./BeforeEndTargetFields";
import { SettingToggleRow } from "./SettingToggleRow";
import { useSettingsLibraries } from "./useSettingsLibraries";

export function BeforeEndRules({ next }: { next: NextEpisodeSettings }) {
  const { t } = useTranslation("preferences");
  const libraries = useSettingsLibraries();

  const writeRules = (rules: BeforeEndRule[]): void => {
    setPlaybackSettings({ next: { beforeEndRules: rules } });
  };
  const patchRule = (index: number, patch: Partial<BeforeEndRule>): void => {
    writeRules(next.beforeEndRules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };

  return (
    <div className="space-y-5">
      <SettingToggleRow
        title={t("beforeEndEnabledTitle")}
        hint={t("beforeEndEnabledHint")}
        active={next.beforeEndEnabled}
        onChange={(beforeEndEnabled) => { setPlaybackSettings({ next: { beforeEndEnabled } }); }}
      />

      {next.beforeEndEnabled && (
        <div className="space-y-5 border-l border-line-subtle pl-4">
          <div>
            <p className="text-sm font-medium text-content-primary">{t("beforeEndDefaultTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
              {t("beforeEndDefaultHint")}
            </p>
            <BeforeEndTargetFields
              idPrefix="before-end-default"
              label={t("beforeEndDefaultTitle")}
              target={next.beforeEndDefault}
              onChange={(beforeEndDefault) => { setPlaybackSettings({ next: { beforeEndDefault } }); }}
            />
          </div>

          {next.beforeEndRules.map((rule, index) => (
            <RuleCard
              key={index}
              index={index}
              rule={rule}
              libraries={libraries}
              onChange={(patch) => { patchRule(index, patch); }}
              onRemove={() => { writeRules(next.beforeEndRules.filter((_, i) => i !== index)); }}
            />
          ))}

          {libraries.length > 0 && next.beforeEndRules.length < BEFORE_END_MAX_RULES && (
            <button
              type="button"
              onClick={() => {
                writeRules([
                  ...next.beforeEndRules,
                  { libraryIds: [libraries[0].id], mode: "seconds", value: 30 },
                ]);
              }}
              className="min-h-11 rounded-lg border border-line-subtle px-4 text-sm font-medium text-content-secondary transition-colors hover:border-line-strong hover:text-content-primary"
            >
              {t("beforeEndAddRule")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface RuleCardProps {
  index: number;
  rule: BeforeEndRule;
  libraries: { id: string; name: string }[];
  onChange: (patch: Partial<BeforeEndRule>) => void;
  onRemove: () => void;
}

/** Une règle : ses bibliothèques, son seuil, et de quoi la retirer. */
function RuleCard({ index, rule, libraries, onChange, onRemove }: RuleCardProps) {
  const { t } = useTranslation("preferences");

  const toggleLibrary = (id: string): void => {
    const next = rule.libraryIds.includes(id)
      ? rule.libraryIds.filter((other) => other !== id)
      : [...rule.libraryIds, id];
    // Une règle sans cible ne s'applique à rien : on ne laisse pas vider.
    if (next.length > 0) onChange({ libraryIds: next });
  };

  return (
    <div className="rounded-lg border border-line-subtle p-4">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-content-primary">
          {t("beforeEndRuleTitle", { index: index + 1 })}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="min-h-11 px-2 text-sm font-medium text-content-tertiary transition-colors hover:text-status-error-fg"
        >
          {t("beforeEndRemoveRule")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {libraries.map((library) => {
          const active = rule.libraryIds.includes(library.id);
          return (
            <button
              key={library.id}
              type="button"
              role="checkbox"
              aria-checked={active}
              onClick={() => { toggleLibrary(library.id); }}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${
                active
                  ? "border-tentacle-accent bg-tentacle-accent font-semibold text-cta-brand-fg"
                  : "border-line-subtle font-medium text-content-tertiary hover:text-content-primary"
              }`}
            >
              {library.name}
            </button>
          );
        })}
      </div>

      <BeforeEndTargetFields
        idPrefix={`before-end-rule-${index}`}
        label={t("beforeEndRuleTitle", { index: index + 1 })}
        target={rule}
        onChange={(target) => { onChange(target); }}
      />
    </div>
  );
}
