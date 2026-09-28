/**
 * La carte d'un titre HORS bibliothèque dans le miroir (téléphone) : celle des
 * sections « Pas encore sur le serveur » de la recherche, d'une filmographie
 * ou d'une saga. La largeur vient du parent (rail ou grille).
 *
 * Au doigt, pas de survol : l'appui long ouvre la feuille des cartes Vigie
 * (`ExternalActionSheet` — « Demander », la note, Ma liste à l'arrivée),
 * portée par la carte elle-même, pour que toute rangée qui la montre l'ait.
 * Il faut pour cela l'identifiant TMDB du titre (`item.tmdbId`). La pastille
 * suit l'état que l'extension donne du titre (« Demandé » dès la demande).
 */

import { useMemo, useState } from "react";
import { Film, Tv } from "lucide-react";
import { titleMediaType, type ExternalSearchItem, type ExternalTone } from "@tentacle-tv/shared";
import { Pressable } from "../../ui/Pressable";
import { ExternalActionSheet, type ExternalSheetTarget } from "../../cards/ExternalActionSheet";
import { useExternalTitleState, type ExternalTitle } from "../../../components/cards/external/useTitleProvider";

/** Affiche 2:3 à contour pointillé, pastille d'état, titre 13 et année 12. */
export function ExternalResultCard({ item, width, onPress }: { item: ExternalSearchItem; width: number; onPress: () => void }) {
  const [broken, setBroken] = useState(false);
  const [sheet, setSheet] = useState<ExternalSheetTarget | null>(null);
  const Icon = item.kind === "series" ? Tv : Film;
  const title = useMemo<ExternalTitle | null>(
    () => (item.tmdbId ? { mediaType: titleMediaType(item.kind), tmdbId: item.tmdbId } : null),
    [item.kind, item.tmdbId],
  );
  const state = useExternalTitleState(title);
  const badge = state?.badge ?? item.badge;
  const openSheet = title
    ? () => setSheet({ title, name: item.title, year: item.year, imageUrl: broken ? null : item.imageUrl })
    : undefined;

  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={openSheet}
        aria-label={[item.title, item.year, badge?.label].filter(Boolean).join(", ")}
        className="shrink-0 active:opacity-70"
        style={{ width }}
      >
        <span
          className="relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-line-subtle bg-surface-2"
          style={{ width, height: width * 1.5 }}
        >
          {item.imageUrl && !broken ? (
            <img src={item.imageUrl} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Icon size={26} className="text-content-quaternary" aria-hidden />
          )}
          {badge && <Badge label={badge.label} tone={badge.tone} />}
        </span>
        <span className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-4 text-content-primary">{item.title}</span>
        {item.year !== null && <span className="block text-xs text-content-tertiary">{item.year}</span>}
      </Pressable>
      {title && <ExternalActionSheet target={sheet} variant="poster" onClose={() => setSheet(null)} />}
    </>
  );
}

/** Les paires d'état du thème (`statusPairs` de l'app) ; `neutral` : pastille sombre. */
const TONE_CLASS: Record<ExternalTone, string> = {
  neutral: "text-on-media-primary",
  info: "bg-status-info-bg text-status-info-fg",
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
};

/** La pastille d'état que le plugin pose sur un titre (« Demandé », « Bientôt »…). */
function Badge({ label, tone }: { label: string; tone: ExternalTone }) {
  return (
    <span
      className={`absolute bottom-1.5 left-1.5 max-w-[88%] truncate rounded-full px-[7px] py-[3px] text-[10.5px] font-semibold ${TONE_CLASS[tone]}`}
      style={tone === "neutral" ? { background: "rgba(var(--scrim-media-rgb), 0.72)" } : undefined}
    >
      {label}
    </span>
  );
}
