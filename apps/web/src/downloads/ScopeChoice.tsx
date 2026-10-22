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
import { GlassButton } from "../components/ui/glass/GlassButton";

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
            // Verre natif : une capsule de verre, la retenue teintée de marque.
            <GlassButton
              key={choice.value}
              role="radio"
              aria-checked={selected}
              disabled={busy && !selected}
              onClick={() => onChange(choice.value)}
              appearance={{ level: selected ? "tinted" : "regular", shape: "capsule" }}
              className="flex-1 px-3 py-2 text-xs font-semibold disabled:opacity-50"
              fallbackClassName={`rounded-full border transition-colors duration-150 ${
                selected
                  ? "border-line-focus bg-fill-medium text-content-primary"
                  : "border-line-subtle bg-fill-subtle text-content-tertiary hover:bg-fill-soft"
              }`}
            >
              {t(choice.key)}
            </GlassButton>
          );
        })}
      </div>
    </div>
  );
}
