import { memo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SharedListItem } from "@tentacle-tv/api-client";
import { CardFrame } from "../cards/CardFrame";
import { CardImage } from "../cards/CardImage";
import { sharedPosterUrl } from "./shareSummary";

interface Props {
  item: SharedListItem;
  /** Fiche publique de ce titre (`/share/:token/:id`) ; absente hors du serveur. */
  to: string | null;
  /** Case de sélection montrée : visiteur connecté, titre présent sur le serveur. */
  selectable: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}

/**
 * L'affiche d'un titre partagé, au dessin des cartes du catalogue : même
 * cadre (`CardFrame` — lift en `transform`, élévation en fondu d'opacité),
 * même image (`CardImage`), même bloc titre que Ma liste et Favoris.
 *
 * Aucun état PERSONNEL ici — ni note perso, ni signet, ni coche « vu » : le
 * visiteur n'a souvent pas de session, et l'API du partage ne transmet pas
 * les états du propriétaire. Le seul marqueur est celui du partage : « Hors
 * serveur », dans la capsule d'angle des marqueurs (noir 70 %, sans flou).
 */
export const SharedPosterCard = memo(function SharedPosterCard({ item, to, selectable, selected, onToggle }: Props) {
  const { t } = useTranslation(["share", "media"]);
  const [hovered, setHovered] = useState(false);
  const poster = sharedPosterUrl(item);
  const kind = item.Type === "Movie" ? t("media:kindMovie") : item.Type === "Series" ? t("media:kindSeries") : null;
  const meta = [item.ProductionYear, kind].filter(Boolean).join(" · ");

  const visual = (
    <>
      <CardFrame hovered={hovered && to !== null} aspect="aspect-[2/3]">
        {poster ? (
          <CardImage src={poster} alt="" zoom={to !== null} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-surface-2 p-3 text-center text-sm font-semibold text-content-tertiary">
            {item.Name}
          </div>
        )}
        {to === null && (
          <span
            title={t("share:offServerHint")}
            className="absolute right-2 top-2 z-20 block h-6 max-w-[calc(100%-1rem)] truncate leading-[22px] whitespace-nowrap rounded-full border border-white/15 bg-black/70 px-2 text-[10px] font-semibold uppercase tracking-wide text-white"
          >
            {t("share:offServerBadge")}
          </span>
        )}
      </CardFrame>
      <div className="mt-2.5 px-0.5">
        <p className="line-clamp-1 text-sm font-semibold tracking-tight text-content-primary">{item.Name}</p>
        {meta && <p className="mt-0.5 text-xs text-content-quaternary">{meta}</p>}
      </div>
    </>
  );

  return (
    <div
      className="group/card relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      // Au-dessus des voisines pendant le survol : l'ombre d'élévation n'est
      // pas recouverte par la cellule suivante (cf. `PosterCard`).
      style={{ zIndex: hovered ? 2 : undefined }}
    >
      {to ? (
        <Link
          to={to}
          aria-label={t("share:openTitle", { name: item.Name })}
          // L'anneau de focus est dessiné par l'affiche (`CardFrame`), qui se soulève.
          className="group/focus block outline-none"
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          {visual}
        </Link>
      ) : (
        <div aria-label={`${item.Name} — ${t("share:offServerHint")}`} role="group">{visual}</div>
      )}

      {selectable && (
        // Cible de 44 px, pastille de 28 : posée SUR l'affiche, noir et blanc
        // constants dans les deux thèmes (règle « posé sur média »).
        <button
          type="button"
          onClick={() => onToggle(item.Id)}
          aria-label={t("share:selectTitle", { name: item.Name })}
          aria-pressed={selected}
          className="absolute left-0 top-0 z-30 flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-lg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors duration-150 ${
              selected ? "border-transparent text-white" : "border-white/60 bg-black/55 text-transparent hover:text-white/60"
            }`}
            style={selected ? { background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" } : undefined}
          >
            <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </button>
      )}

      {selected && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 aspect-[2/3] rounded-[var(--radius-lg)] ring-2 ring-[var(--brand)]" />
      )}
    </div>
  );
});
