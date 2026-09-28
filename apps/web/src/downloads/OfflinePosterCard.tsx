/**
 * Carte VERTICALE (2:3) des titres gardés sur la machine : films et séries.
 *
 * La grammaire des affiches en ligne (`PosterTile`), à la source près — tout
 * vient du disque :
 *   • AU REPOS : la note en bas à gauche, la coche « vu » en haut à droite, la
 *     progression au bord inférieur ;
 *   • AU SURVOL (ou au focus clavier) : le survol unique des cartes, variante
 *     `poster`, en mode LOCAL — puces qualité/langues du FICHIER, Lecture au
 *     centre, et la seule bascule qui vive sur la machine, la coche « vu ».
 *     Ni Ma liste, ni favoris, ni note : ils passent par le serveur.
 *
 * Le clic ouvre la fiche locale ; le survol est MONTÉ à la demande, jamais
 * laissé à `opacity: 0`.
 */

import { memo, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { CardFrame } from "../components/cards/CardFrame";
import { CardHoverOverlay } from "../components/cards/CardHoverOverlay";
import { CardProgressBar } from "../components/cards/CardProgressBar";
import { CardRatingBadge } from "../components/cards/CardRatingBadge";
import { CardStatusMarkers } from "../components/cards/CardStatusMarkers";
import { useMountWhile } from "../hooks/useMountWhile";
import { LocalCardImage } from "./LocalCardImage";

export interface LocalCardPlay {
  resume: boolean;
  /** « Reprendre S1 · E3 » quand l'appelant en sait plus que « Lecture ». */
  label?: string;
  onPlay: () => void;
}

interface OfflinePosterCardProps {
  title: string;
  subtitle?: string | null;
  /** Item dont le snapshot porte les visuels (le film, ou l'épisode porteur d'une série). */
  imageItemId: string;
  /** Visuels du snapshot, dans l'ordre de préférence. */
  imageCandidates: readonly string[];
  /** Le DTO local (flux du fichier, progression locale) : puces du survol. */
  item: MediaItem;
  /** Note globale, lue dans le snapshot. */
  rating: number | null;
  watched: boolean;
  /** Avancement en %, `null` sans reprise. */
  percent: number | null;
  play: LocalCardPlay | null;
  onOpen: () => void;
  onToggleWatched: () => void;
}

const WATCHED: readonly ["watched"] = ["watched"];
const NONE: readonly [] = [];

export const OfflinePosterCard = memo(function OfflinePosterCard({
  title, subtitle, imageItemId, imageCandidates, item, rating, watched, percent, play, onOpen, onToggleWatched,
}: OfflinePosterCardProps) {
  const [hovered, setHovered] = useState(false);
  const overlayMounted = useMountWhile(hovered, 200);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={subtitle ? `${title} · ${subtitle}` : title}
      className="group/card relative cursor-pointer rounded-[var(--radius-lg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
      style={{ zIndex: hovered ? 2 : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false);
      }}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <CardFrame hovered={hovered} aspect="aspect-[2/3]">
        <LocalCardImage itemId={imageItemId} candidates={imageCandidates} fallback={title} />
        <CardRatingBadge rating={rating} shown={!hovered} />
        <CardStatusMarkers statuses={watched ? WATCHED : NONE} shown={!hovered} />
        {overlayMounted && (
          <CardHoverOverlay
            variant="poster"
            item={item}
            title={title}
            visible={hovered}
            play={play && {
              resume: play.resume,
              label: play.label,
              onPlay: (e: MouseEvent) => {
                e.stopPropagation();
                e.preventDefault();
                play.onPlay();
              },
            }}
            meta={item}
            local={{
              states: { watchlist: false, favorite: false, watched },
              onToggle: (kind) => {
                if (kind === "watched") onToggleWatched();
              },
            }}
          />
        )}
        {!watched && (
          <div className="absolute inset-x-0 bottom-0 z-30">
            <CardProgressBar percent={percent} />
          </div>
        )}
      </CardFrame>
      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold tracking-tight text-content-primary">{title}</h3>
        {subtitle && <p className="mt-0.5 truncate text-xs text-content-quaternary">{subtitle}</p>}
      </div>
    </div>
  );
});
