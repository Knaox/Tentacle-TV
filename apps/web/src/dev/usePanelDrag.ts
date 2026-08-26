/**
 * Déplacement du panneau de diagnostic à la souris.
 *
 * Écrit à la main plutôt qu'avec une bibliothèque : c'est un outil de
 * développement, il ne doit rien peser dans les dépendances du produit.
 *
 * Les écouteurs vivent sur `window` et non sur le panneau : une souris qui
 * sort du panneau pendant le glisser doit continuer à le déplacer, sinon il
 * « décroche » dès qu'on va vite.
 *
 * Depuis que le bouton DEBUG se déplace aussi : `cle` persiste la position en
 * localStorage (écrite AU LÂCHER seulement, re-clampée au chargement — modèle
 * `useChatPanelSize`), `saisirBoutons` court-circuite la garde anti-boutons
 * (indispensable pour glisser le bouton lui-même), et `aGlisse` dit si le
 * geste qui vient de finir était un déplacement — le clic qui le suit ne doit
 * pas ouvrir le panneau.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Position {
  x: number;
  y: number;
}

export interface OptionsDrag {
  /** Clé localStorage ; absente = position non persistée. */
  cle?: string;
  /** Laisser saisir un `<button>` — pour déplacer le bouton DEBUG lui-même. */
  saisirBoutons?: boolean;
}

const MARGE = 8;
/** En deçà, un pointerdown+up est un CLIC, pas un déplacement. */
const SEUIL_GLISSE_PX = 3;

/** Garde le panneau dans la fenêtre, même après un redimensionnement. */
function contenir(p: Position, largeur: number, hauteur: number): Position {
  return {
    x: Math.min(Math.max(p.x, MARGE), Math.max(MARGE, innerWidth - largeur - MARGE)),
    y: Math.min(Math.max(p.y, MARGE), Math.max(MARGE, innerHeight - hauteur - MARGE)),
  };
}

function chargerPosition(cle: string | undefined, repli: Position): Position {
  if (!cle) return repli;
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const p = JSON.parse(brut) as Partial<Position>;
      if (typeof p.x === "number" && typeof p.y === "number") {
        // Taille inconnue avant le premier rendu : clamp au viewport seul ;
        // l'effet `resize` re-clampe avec la vraie taille dès qu'elle existe.
        return contenir({ x: p.x, y: p.y }, 0, 0);
      }
    }
  } catch {
    /* stockage indisponible/corrompu → position par défaut */
  }
  return repli;
}

export function usePanelDrag(initial: Position, options?: OptionsDrag) {
  const { cle, saisirBoutons = false } = options ?? {};
  const [position, setPosition] = useState<Position>(() => chargerPosition(cle, initial));
  const element = useRef<HTMLElement | null>(null);
  const depart = useRef<{ souris: Position; panneau: Position } | null>(null);
  /** Le geste en cours (ou le dernier) a-t-il dépassé le seuil de déplacement ? */
  const aGlisse = useRef(false);
  // Miroirs pour lire la dernière valeur au lâcher sans re-créer l'écouteur.
  const positionRef = useRef(position);
  positionRef.current = position;
  const cleRef = useRef(cle);
  cleRef.current = cle;

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Un clic sur un bouton du panneau ne doit pas le déplacer — sauf quand
      // c'est le bouton lui-même qu'on déplace.
      if (!saisirBoutons && (e.target as HTMLElement).closest("button")) return;
      aGlisse.current = false;
      depart.current = { souris: { x: e.clientX, y: e.clientY }, panneau: position };
    },
    [position, saisirBoutons],
  );

  useEffect(() => {
    const bouger = (e: PointerEvent): void => {
      const d = depart.current;
      if (!d) return;
      const dx = e.clientX - d.souris.x;
      const dy = e.clientY - d.souris.y;
      if (Math.abs(dx) + Math.abs(dy) > SEUIL_GLISSE_PX) aGlisse.current = true;
      const el = element.current;
      setPosition(contenir({ x: d.panneau.x + dx, y: d.panneau.y + dy }, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
    };
    const lacher = (): void => {
      if (depart.current === null) return;
      depart.current = null;
      // Au lâcher seulement, jamais à chaque frame — et uniquement après un
      // vrai déplacement : un simple clic ne réécrit pas le stockage.
      if (cleRef.current && aGlisse.current) {
        try {
          localStorage.setItem(cleRef.current, JSON.stringify(positionRef.current));
        } catch {
          /* ignore */
        }
      }
    };
    addEventListener("pointermove", bouger);
    addEventListener("pointerup", lacher);
    return () => {
      removeEventListener("pointermove", bouger);
      removeEventListener("pointerup", lacher);
    };
  }, []);

  /** Ramène l'élément dans la fenêtre — après un resize du panneau lui-même. */
  const recontenir = useCallback((): void => {
    const el = element.current;
    setPosition((p) => contenir(p, el?.offsetWidth ?? 0, el?.offsetHeight ?? 0));
  }, []);

  // Un panneau laissé hors écran après un redimensionnement serait
  // irrécupérable : on le ramène.
  useEffect(() => {
    addEventListener("resize", recontenir);
    return () => removeEventListener("resize", recontenir);
  }, [recontenir]);

  return { position, element, onPointerDown, aGlisse, recontenir };
}
