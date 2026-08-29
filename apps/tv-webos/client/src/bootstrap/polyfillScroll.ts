/**
 * Le défilement programmé, à la forme d'objet.
 *
 * Deux histoires très différentes sous le même nom, et c'est tout le piège.
 *
 * Sur `Element`, Chrome 53 ne connaît **ni** `scrollTo` **ni** `scrollBy` —
 * Chrome 61 les apporte, et core-js ne couvre pas le DOM. `useRowScroll` et
 * `useHorizontalScroll` appellent `element.scrollBy({ left, behavior })` : sans
 * polyfill, le premier défilement de rangée lève. Tester la présence du nom y
 * répond juste.
 *
 * Sur `window`, les deux **existent depuis toujours** : c'est leur forme à
 * OBJET qui manque. Le même test y répond donc « rien à faire », et
 * `window.scrollTo({ top: 0, behavior: "smooth" })` — ce que `LibraryGrid` fait
 * au montage — lève « 2 arguments required, but only 1 present ». Mesuré sur
 * l'émulateur webOS 4.0 : l'exception démontait tout l'arbre React et l'écran
 * de bibliothèque restait NOIR, sans un mot.
 *
 * D'où la règle : sur la fenêtre on éprouve la PRISE EN CHARGE DE LA FORME, pas
 * la présence du nom, et l'on **enveloppe** la méthode native au lieu de la
 * définir.
 *
 * Le défilement doux (`behavior: "smooth"`, Chrome 61 également) n'est pas
 * reproduit : l'écriture est directe, donc instantanée. Sur un téléviseur, le
 * défilement des rangées suit le focus et non un geste — un saut net y est
 * même préférable à une glisse, qui donnerait l'impression d'un retard à
 * chaque appui sur la télécommande.
 */

interface ScrollOptions2 {
  left?: number;
  top?: number;
}

type ScrollTarget = Element | Window;

/** Pose une position absolue sur la cible. Diffère entre un élément et la fenêtre. */
type Setter = (target: ScrollTarget, x: number, y: number) => void;

function isOptions(value: unknown): value is ScrollOptions2 {
  return typeof value === "object" && value !== null;
}

function currentPosition(target: ScrollTarget): { x: number; y: number } {
  if (target instanceof Window) {
    return { x: target.pageXOffset, y: target.pageYOffset };
  }
  return { x: target.scrollLeft, y: target.scrollTop };
}

function createScrollTo(setPosition: Setter) {
  return function (this: ScrollTarget, a: unknown, b?: unknown): void {
    if (isOptions(a)) {
      const current2 = currentPosition(this);
      setPosition(this, a.left ?? current2.x, a.top ?? current2.y);
      return;
    }
    setPosition(this, Number(a) || 0, Number(b) || 0);
  };
}

function createScrollBy(setPosition: Setter) {
  return function (this: ScrollTarget, a: unknown, b?: unknown): void {
    const current2 = currentPosition(this);
    if (isOptions(a)) {
      setPosition(this, current2.x + (a.left ?? 0), current2.y + (a.top ?? 0));
      return;
    }
    setPosition(this, current2.x + (Number(a) || 0), current2.y + (Number(b) || 0));
  };
}

function installOnElement(): void {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  const setPosition: Setter = (target, x, y) => {
    const element = target as Element;
    element.scrollLeft = x;
    element.scrollTop = y;
  };

  if (typeof proto.scrollTo !== "function") proto.scrollTo = createScrollTo(setPosition);
  if (typeof proto.scrollBy !== "function") proto.scrollBy = createScrollBy(setPosition);
}

/**
 * La méthode accepte-t-elle un objet ?
 *
 * On l'appelle, c'est le seul moyen fiable. Un objet VIDE ne déplace rien : la
 * spécification fait retomber `left` et `top` absents sur la position courante,
 * et un moteur qui refuse la forme lève avant d'avoir bougé quoi que ce soit.
 * La sonde est donc sans effet dans les deux cas.
 */
function acceptsObject(window: Window, name: string): boolean {
  const method = (window as unknown as Record<string, unknown>)[name];
  if (typeof method !== "function") return false;
  try {
    (method as (options: ScrollOptions2) => void).call(window, {});
    return true;
  } catch {
    return false;
  }
}

function installOnWindow(window: Window): void {
  const proto = window as unknown as Record<string, unknown>;

  // Capturée AVANT toute enveloppe : c'est elle qui déplace réellement la page,
  // et les trois enveloppes s'appuient dessus. La prendre après reviendrait à
  // s'appeler soi-même.
  const native = proto.scrollTo as ((x: number, y: number) => void) | undefined;
  const setPosition: Setter = (target, x, y) => {
    if (typeof native === "function") native.call(target, x, y);
  };

  // `scroll` est l'alias historique de `scrollTo` — même défaut, même correctif.
  for (const name of ["scrollTo", "scroll"]) {
    if (!acceptsObject(window, name)) proto[name] = createScrollTo(setPosition);
  }
  if (!acceptsObject(window, "scrollBy")) proto.scrollBy = createScrollBy(setPosition);
}

export function installScrollPolyfill(): void {
  if (typeof Element !== "undefined") installOnElement();
  if (typeof window !== "undefined") installOnWindow(window);
}
