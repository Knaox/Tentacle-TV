/**
 * Le choix du PÉRIMÈTRE, en tête du dialogue de téléchargement : cet épisode,
 * sa saison, ou toute la série.
 *
 * Il vit DANS le dialogue et non dans une seconde fenêtre — le contenu change
 * sur place, comme sur le téléphone (`offline/keep/ScopeChoice.tsx`).
 *
 * Un segmenté NEUTRE (`SheetSegments`) : la pilule d'encre du socle hors verre
 * natif, le segmenté du contenu (`.lg-seg`) sous le verre de macOS 26.
 */

import { useTranslation } from "react-i18next";
import { SheetSegments } from "./ui/SheetSegments";

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
    <div className="flex flex-col gap-2.5">
      <span className="ui-eyebrow">{t("downloads:scopeLabel")}</span>
      <SheetSegments
        label={t("downloads:scopeLabel")}
        value={value}
        busy={busy}
        onChange={onChange}
        options={CHOICES.map((choice) => ({ value: choice.value, label: t(choice.key) }))}
      />
    </div>
  );
}
