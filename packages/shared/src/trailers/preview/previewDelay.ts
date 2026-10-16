/**
 * Le DÉLAI de l'aperçu : le temps entre le début du survol (web, bureau) ou
 * du focus (téléviseurs) et la PREMIÈRE IMAGE de l'aperçu. Le même partout —
 * cartes de la bibliothèque comme titres de Vigie — et choisi par
 * l'UTILISATEUR, sur son appareil (pas une capacité du serveur : une fonction
 * purement client). 800 ms par défaut (décision du 16/10 : à 600 ms, l'aperçu
 * partait trop vite et gênait la navigation).
 *
 * Le délai est un MINIMUM : l'aperçu paraît à `max(délai, première image)`.
 * Pour le tenir quand la source est lente, la demande part AVANT le délai
 * (`intentMs` = délai − l'avance de la plateforme), jamais avant le plancher
 * de la plateforme — c'est lui qui écarte un défilement rapide (une souris qui
 * balaie, une flèche tenue) : rien n'est demandé pendant qu'on passe. Module
 * pur.
 */

import type { TrailerPreviewTiming } from "./previewTiming";

/** Les choix offerts (ms), du plus vif au plus posé. */
export const TRAILER_PREVIEW_DELAYS = [500, 800, 1200, 2000] as const;

export type TrailerPreviewDelay = (typeof TRAILER_PREVIEW_DELAYS)[number];

export const DEFAULT_TRAILER_PREVIEW_DELAY: TrailerPreviewDelay = 800;

/**
 * Une valeur gardée (texte ou nombre) → un choix offert ; tout le reste → le
 * défaut. `choices` : ceux d'une plateforme qui n'offre pas tout (les
 * téléviseurs, tv-core `TV_TRAILER_PREVIEW_DELAYS`).
 */
export function parseTrailerPreviewDelay(
  raw: unknown, choices: readonly TrailerPreviewDelay[] = TRAILER_PREVIEW_DELAYS,
): TrailerPreviewDelay {
  const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  return (choices as readonly unknown[]).includes(value) ? (value as TrailerPreviewDelay) : DEFAULT_TRAILER_PREVIEW_DELAY;
}

/**
 * Le pas d'une plateforme : `floorMs`, le survol ou le focus TENU sous lequel
 * rien n'est demandé (le filtre du défilement rapide) ; `leadMs`, l'avance
 * qu'il faut d'ordinaire entre la demande et la première image (réponse du
 * serveur préparée d'avance, puis le lecteur).
 */
export interface TrailerPreviewPace {
  floorMs: number;
  leadMs: number;
}

/**
 * Le web et le bureau : la demande à 400 ms pour une image à 800 ms ; jamais
 * avant 200 ms de survol (et un pointeur arrêté, `intentStillMs`).
 */
export const WEB_TRAILER_PREVIEW_PACE: TrailerPreviewPace = { floorMs: 200, leadMs: 400 };

/** Les temps d'une machine d'aperçu pour un délai choisi : la révélation AU délai, la demande avant lui. */
export function trailerPreviewTimingFor<T extends TrailerPreviewTiming>(base: T, delayMs: number, pace: TrailerPreviewPace): T {
  const delay = parseTrailerPreviewDelay(delayMs);
  const intentMs = Math.min(delay, Math.max(pace.floorMs, delay - pace.leadMs));
  return { ...base, intentMs, revealMs: delay };
}
