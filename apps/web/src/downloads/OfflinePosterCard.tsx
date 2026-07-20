/**
 * Carte VERTICALE (2:3) du catalogue hors ligne : films et groupes de saison.
 * Les images viennent du disque (serveur loopback) ; plusieurs candidats sont
 * essayés en cascade — l'affiche de série d'abord pour une saison, l'affiche
 * de l'item pour un film.
 */

import { memo, useEffect, useState } from "react";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";

interface OfflinePosterCardProps {
  title: string;
  subtitle?: string;
  /** Chemins RELATIFS à la racine, essayés dans l'ordre. */
  imageCandidates: string[];
  onClick: () => void;
}

export const OfflinePosterCard = memo(function OfflinePosterCard({
  title,
  subtitle,
  imageCandidates,
  onClick,
}: OfflinePosterCardProps) {
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
      <div className="aspect-[2/3] overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line-subtle">
        {url ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setAttempt((n) => n + 1)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-content-quaternary">
            {title}
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-content-secondary group-hover/card:text-content-primary">
        {title}
      </p>
      {subtitle && <p className="truncate text-[10px] text-content-quaternary">{subtitle}</p>}
    </button>
  );
});
