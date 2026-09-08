/**
 * Le choix du PÉRIMÈTRE, en tête du dialogue de téléchargement : cet épisode,
 * sa saison, ou toute la série.
 *
 * Il vit DANS le dialogue et non dans une seconde fenêtre — le contenu change
 * sur place, comme sur le téléphone (`offline/keep/ScopeChoice.tsx`). Jusqu'ici
 * le bureau n'avait aucun élargissement : une saison se prenait depuis la barre
 * de saison, une série pas du tout.
 */

import { useTranslation } from "react-i18next";

export type DownloadScope = "episode" | "season" | "series";

const CHOICES: ReadonlyArray<{ value: DownloadScope; key: string }> = [
  { value: "episode", key: "downloads:scopeEpisode" },
  { value: "season", key: "downloads:scopeSeason" },
  { value: "series", key: "downloads:scopeSeries" },
];

interface Props {
  value: DownloadScope;
  onChange: (scope: DownloadScope) => void;
  /** Le périmètre se charge : les autres restent lisibles, le geste attend. */
  busy?: boolean;
}

export function ScopeChoice({ value, onChange, busy = false }: Props) {
  const { t } = useTranslation(["downloads"]);
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
        {t("downloads:scopeLabel")}
      </p>
      <div className="flex gap-2" role="radiogroup" aria-label={t("downloads:scopeLabel")}>
        {CHOICES.map((choice) => {
          const selected = choice.value === value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy && !selected}
              onClick={() => onChange(choice.value)}
              className={`flex-1 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-50 ${
                selected
                  ? "border-line-focus bg-fill-medium text-content-primary"
                  : "border-line-subtle bg-fill-subtle text-content-tertiary hover:bg-fill-soft"
              }`}
            >
              {t(choice.key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
