/**
 * `Element.scrollBy` et `Element.scrollTo` — Chrome 61.
 *
 * Ce n'est pas une dégradation silencieuse : `useRowScroll` et
 * `useHorizontalScroll` appellent `element.scrollBy({ left, behavior })`, et un
 * moteur qui ne connaît pas la méthode lève un `TypeError` au premier
 * défilement de rangée. core-js ne les couvre pas — ce sont des API du DOM.
 *
 * Le défilement doux (`behavior: "smooth"`, Chrome 61 également) n'est pas
 * reproduit : l'écriture est directe, donc instantanée. Sur un téléviseur, le
 * défilement des rangées suit le focus et non un geste — un saut net y est
 * même préférable à une glisse, qui donnerait l'impression d'un retard à
 * chaque appui sur la télécommande.
 */

interface OptionsDefilement {
  left?: number;
  top?: number;
}

type CibleDefilement = Element | Window;

function estOptions(valeur: unknown): valeur is OptionsDefilement {
  return typeof valeur === "object" && valeur !== null;
}

function positionCourante(cible: CibleDefilement): { x: number; y: number } {
  if (cible instanceof Window) {
    return { x: cible.pageXOffset, y: cible.pageYOffset };
  }
  return { x: cible.scrollLeft, y: cible.scrollTop };
}

function poserPosition(cible: CibleDefilement, x: number, y: number): void {
  if (cible instanceof Window) {
    cible.scroll(x, y);
    return;
  }
  cible.scrollLeft = x;
  cible.scrollTop = y;
}

function installerSur(prototype: Element | Window): void {
  const objet = prototype as unknown as Record<string, unknown>;

  if (typeof objet.scrollTo !== "function") {
    objet.scrollTo = function (this: CibleDefilement, a: unknown, b?: unknown): void {
      if (estOptions(a)) {
        const actuelle = positionCourante(this);
        poserPosition(this, a.left ?? actuelle.x, a.top ?? actuelle.y);
        return;
      }
      poserPosition(this, Number(a) || 0, Number(b) || 0);
    };
  }

  if (typeof objet.scrollBy !== "function") {
    objet.scrollBy = function (this: CibleDefilement, a: unknown, b?: unknown): void {
      const actuelle = positionCourante(this);
      if (estOptions(a)) {
        poserPosition(this, actuelle.x + (a.left ?? 0), actuelle.y + (a.top ?? 0));
        return;
      }
      poserPosition(this, actuelle.x + (Number(a) || 0), actuelle.y + (Number(b) || 0));
    };
  }
}

export function installerPolyfillDefilement(): void {
  if (typeof Element !== "undefined") installerSur(Element.prototype);
  if (typeof window !== "undefined") installerSur(window);
}
