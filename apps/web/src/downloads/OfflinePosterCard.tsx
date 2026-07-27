/**
 * Carte VERTICALE (2:3) du catalogue hors ligne : films et groupes de saison.
 * Les images viennent du disque (serveur loopback) ; plusieurs candidats sont
 * essayés en cascade — l'affiche de série d'abord pour une saison, l'affiche
 * de l'item pour un film.
 */

import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CardProgressBar } from "../components/cards/CardProgressBar";
import { CardWatchedBadge } from "../components/cards/CardWatchedBadge";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";

interface OfflinePosterCardProps {
  title: string;
  subtitle?: string;
  /** Chemins RELATIFS à la racine, essayés dans l'ordre. */
  imageCandidates: string[];
  /** Progression LOCALE (`watchStateOf`) : hors ligne, aucun DTO serveur. */
  watched?: boolean;
  percent?: number | null;
  onClick: () => void;
}

export const OfflinePosterCard = memo(function OfflinePosterCard({
  title,
  subtitle,
  imageCandidates,
  watched = false,
  percent = null,
  onClick,
}: OfflinePosterCardProps) {
  const { t } = useTranslation("common");
  const rootReady = useDownloadsRootReady();
  const [attempt, setAttempt] = useState(0);

  // Nouvelle liste de candidats (changement de filtre, de recherche) → on
  // repart du premier, sinon un échec passé masquerait une image valide.
  useEffect(() => setAttempt(0), [imageCandidates.join("|")]);

  const url = rootReady ? localResourceUrl(imageCandidates[attempt] ?? "") : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group/card text-left transition-transform duration-200 hover:scale-[1.03]"
      title={subtitle ? `${title} · ${subtitle}` : title}
    >
      {/* `relative` : la coche et la barre se posent dans ce cadre, pas dans
          le bouton — sinon la barre passerait sous le titre. */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line-subtle">
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy" decoding="async"
            className="h-full w-full object-cover"
            onError={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-content-quaternary">
            {title}
          </div>
        )}
        {/* Coche OU barre, jamais les deux — même règle qu'en ligne. */}
        {watched ? <CardWatchedBadge label={t("common:watched")} /> : <CardProgressBar percent={percent} />}
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-content-secondary group-hover/card:text-content-primary">
        {title}
      </p>
      {subtitle && <p className="truncate text-[10px] text-content-quaternary">{subtitle}</p>}
    </button>
  );
});
