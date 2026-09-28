import { useEffect, useState } from "react";
import { localResourceUrl, useDownloadsRootReady } from "./localFiles";

interface Props {
  itemId: string;
  /** Visuels du snapshot, essayés dans l'ordre (`primary.jpg`, `backdrop.jpg`…). */
  candidates: readonly string[];
  /** Ce qui s'affiche quand aucun n'existe (transfert hérité) : le titre, en clair. */
  fallback: string;
}

/**
 * L'image d'une carte hors ligne, lue sur le disque : premier candidat qui
 * charge, puis le suivant sur erreur, puis le titre en toutes lettres. Aucune
 * requête réseau — le serveur loopback répond depuis la machine.
 */
export function LocalCardImage({ itemId, candidates, fallback }: Props) {
  const rootReady = useDownloadsRootReady();
  const [attempt, setAttempt] = useState(0);
  const key = `${itemId}|${candidates.join("|")}`;
  // Nouvelle liste (filtre, recherche, autre titre) : on repart du premier.
  useEffect(() => setAttempt(0), [key]);

  const name = candidates[attempt];
  const url = rootReady && name ? localResourceUrl(`meta/${itemId}/${name}`) : null;
  if (url === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-2 px-3 text-center text-xs font-medium text-content-quaternary">
        {rootReady && name === undefined ? fallback : null}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      className="h-full w-full object-cover"
      onError={() => setAttempt((n) => n + 1)}
    />
  );
}
