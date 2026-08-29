import { useRef } from "react";
import type { AnchorRect, PreviewBounds } from "@/components/cards/hoverPreviewGeometry";

/**
 * Le survol, éteint côté JavaScript.
 *
 * `hoverPass` retire les règles `:hover` de la feuille ; il reste les
 * gestionnaires `onMouseEnter` du client web, que le CSS ne peut pas atteindre.
 * Ce sont eux qui font basculer `data-hovered`, qui montent le panneau d'aperçu
 * et qui posent des écouteurs globaux. Ce module remplace les trois hooks qui
 * les portent.
 *
 * Il en remplace trois pour un seul motif, d'où le fichier unique — trois
 * entrées de `substitutionTable.ts` pointent ici :
 *
 *   • `useHoverPreview` — le panneau d'aperçu. Son garde est
 *     `(hover:hover) and (pointer:fine)` ET une largeur d'au moins 1024 px :
 *     mesuré à 1280 dans le canevas du téléviseur, il répond **vrai**. Le seuil
 *     ne protège donc de rien ici.
 *   • `useHoverGuard` — pose un écouteur `pointermove` global **à l'import du
 *     module**, avant même qu'un composant soit monté. Le neutraliser demandait
 *     de ne pas charger le module du tout.
 *   • `useHoverMount` — monte à la demande les flèches de bannière et les
 *     chevrons de rangée. Rendre `mounted` toujours faux les retire du DOM :
 *     ce sont des commandes de souris, et la règle de coût GPU du dépôt veut
 *     qu'on démonte plutôt qu'on masque.
 *
 * Ce qui n'est PAS éteint : le **clic**. Le moteur de focus gère déjà un mode
 * pointeur (`focus/cursor.ts`) et s'efface quand la Magic Remote est visible.
 * On retire la sélection au survol, pas le pointeur.
 */

/** Forme rendue par `useHoverPreview`, reprise à l'identique du client web. */
export interface HoverPreview {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  eligible: boolean;
  panelActive: boolean;
  open: boolean;
  cut: boolean;
  anchor: AnchorRect | null;
  bounds: PreviewBounds | undefined;
  close: () => void;
  handlers: { onMouseEnter: () => void; onMouseLeave: () => void };
  panelHandlers: { onMouseEnter: () => void; onMouseLeave: () => void };
}

function nothingAry(): void {
  /* Le survol n'existe pas sur un téléviseur. */
}

// Identités stables : ces objets partent en props vers des composants mémoïsés,
// une nouvelle identité à chaque rendu les re-rendrait pour rien.
const HANDLERS = { onMouseEnter: nothingAry, onMouseLeave: nothingAry } as const;

/**
 * `eligible` est faux, et ce n'est pas anodin : la carte s'en sert pour décider
 * si elle doit sortir ses propres actions en surimpression, le panneau les
 * portant d'ordinaire. Faux est bien la valeur voulue — il n'y aura pas de
 * panneau, donc la carte reste seule maîtresse de ce qu'elle affiche.
 */
export function useHoverPreview(_disabled = false): HoverPreview {
  const anchorRef = useRef<HTMLDivElement>(null);

  return {
    anchorRef,
    eligible: false,
    panelActive: false,
    open: false,
    cut: false,
    anchor: null,
    bounds: undefined,
    close: nothingAry,
    handlers: HANDLERS,
    panelHandlers: HANDLERS,
  };
}

/** Sans pointeur à surveiller, il n'y a rien à revalider. */
export function useHoverGuard(
  _ref: React.RefObject<HTMLElement | null>,
  _active: boolean,
  _sortie: () => void,
): void {
  /* Aucun écouteur global. */
}

/** Même raison que ci-dessus, pour la barre de progression du lecteur. */
export function useHoverEscape(
  _ref: React.RefObject<HTMLElement | null>,
  _active: boolean,
  _sortie: () => void,
): void {
  /* Aucun écouteur global. */
}

/**
 * `true` reprend la sémantique du client web quand il n'y a rien à interroger :
 * ne pas conclure au départ du pointeur. Aucun appelant n'en dépend ici, la
 * fonction n'existe que pour que le module reste substituable en bloc.
 */
export function pointerStillOn(_element: HTMLElement | null): boolean {
  return true;
}

/**
 * `mounted` toujours faux : les commandes révélées au survol ne sont jamais
 * montées. `hovered` suit, pour que le style de l'appelant reste cohérent.
 */
export function useHoverMount(_sortieMs: number): {
  hovered: boolean;
  mounted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
} {
  return { hovered: false, mounted: false, ...HANDLERS };
}
