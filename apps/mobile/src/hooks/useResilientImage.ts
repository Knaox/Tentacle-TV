import { useState } from "react";

/**
 * Une image qui ne se rend pas ne condamne pas la carte.
 *
 * Deux défauts se cumulaient : l'état d'échec n'était jamais remis à zéro (une
 * carte recyclée gardait la panne de la précédente, et une affiche apparue
 * après coup restait grise jusqu'au démontage), et un seul refus suffisait à
 * renoncer.
 *
 * Le second essai change la LARGEUR demandée, sans quoi il ne servirait à
 * rien : mesuré sur ce serveur, Jellyfin rend `200 OK`, `image/jpeg` et
 * ZÉRO octet pour une taille précise d'une affiche précise — 280 et 320 px
 * passent, 300 non (un fichier de cache vide, côté serveur). Redemander la
 * même URL rendrait le même vide ; une largeur voisine rend l'image.
 */

/** Facteur du second essai : assez loin pour tomber sur une autre entrée de cache. */
const RETRY_SCALE = 1.5;

/** Réécrit `maxWidth`/`maxHeight` d'une URL d'image Jellyfin ; `null` s'il n'y en a pas. */
function widenUrl(uri: string, scale: number): string | null {
  let touched = false;
  const next = uri.replace(/\b(maxWidth|maxHeight)=(\d+)\b/g, (_all, key: string, value: string) => {
    touched = true;
    return `${key}=${Math.round(Number(value) * scale)}`;
  });
  return touched ? next : null;
}

export interface ResilientImage {
  /** L'URI à rendre, ou `null` quand il ne reste plus rien à tenter. */
  uri: string | null;
  /** Tous les essais ont échoué : à l'appelant de rendre son repli. */
  failed: boolean;
  onError: () => void;
}

export function useResilientImage(source: string | null): ResilientImage {
  const [state, setState] = useState<{ source: string | null; uri: string | null; failed: boolean }>({
    source,
    uri: source,
    failed: false,
  });

  // Clé sur la source : un changement d'URL rouvre le droit à l'échec.
  if (state.source !== source) {
    setState({ source, uri: source, failed: false });
    return { uri: source, failed: false, onError: () => {} };
  }

  const onError = (): void => {
    setState((prev) => {
      if (prev.failed || prev.uri === null) return prev;
      const retry = prev.uri === prev.source ? widenUrl(prev.uri, RETRY_SCALE) : null;
      return retry === null
        ? { ...prev, uri: null, failed: true }
        : { ...prev, uri: retry };
    });
  };

  return { uri: state.uri, failed: state.failed, onError };
}
