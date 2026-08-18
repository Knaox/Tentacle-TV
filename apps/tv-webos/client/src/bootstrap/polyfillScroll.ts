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

interface OptionsDefilement {
  left?: number;
  top?: number;
}

type CibleDefilement = Element | Window;

/** Pose une position absolue sur la cible. Diffère entre un élément et la fenêtre. */
type Poseur = (cible: CibleDefilement, x: number, y: number) => void;

function estOptions(valeur: unknown): valeur is OptionsDefilement {
  return typeof valeur === "object" && valeur !== null;
}

function positionCourante(cible: CibleDefilement): { x: number; y: number } {
  if (cible instanceof Window) {
    return { x: cible.pageXOffset, y: cible.pageYOffset };
  }
  return { x: cible.scrollLeft, y: cible.scrollTop };
}

function creerScrollTo(poser: Poseur) {
  return function (this: CibleDefilement, a: unknown, b?: unknown): void {
    if (estOptions(a)) {
      const actuelle = positionCourante(this);
      poser(this, a.left ?? actuelle.x, a.top ?? actuelle.y);
      return;
    }
    poser(this, Number(a) || 0, Number(b) || 0);
  };
}

function creerScrollBy(poser: Poseur) {
  return function (this: CibleDefilement, a: unknown, b?: unknown): void {
    const actuelle = positionCourante(this);
    if (estOptions(a)) {
      poser(this, actuelle.x + (a.left ?? 0), actuelle.y + (a.top ?? 0));
      return;
    }
    poser(this, actuelle.x + (Number(a) || 0), actuelle.y + (Number(b) || 0));
  };
}

function installerSurElement(): void {
  const objet = Element.prototype as unknown as Record<string, unknown>;
  const poser: Poseur = (cible, x, y) => {
    const element = cible as Element;
    element.scrollLeft = x;
    element.scrollTop = y;
  };

  if (typeof objet.scrollTo !== "function") objet.scrollTo = creerScrollTo(poser);
  if (typeof objet.scrollBy !== "function") objet.scrollBy = creerScrollBy(poser);
}

/**
 * La méthode accepte-t-elle un objet ?
 *
 * On l'appelle, c'est le seul moyen fiable. Un objet VIDE ne déplace rien : la
 * spécification fait retomber `left` et `top` absents sur la position courante,
 * et un moteur qui refuse la forme lève avant d'avoir bougé quoi que ce soit.
 * La sonde est donc sans effet dans les deux cas.
 */
function accepteUnObjet(fenetre: Window, nom: string): boolean {
  const methode = (fenetre as unknown as Record<string, unknown>)[nom];
  if (typeof methode !== "function") return false;
  try {
    (methode as (options: OptionsDefilement) => void).call(fenetre, {});
    return true;
  } catch {
    return false;
  }
}

function installerSurFenetre(fenetre: Window): void {
  const objet = fenetre as unknown as Record<string, unknown>;

  // Capturée AVANT toute enveloppe : c'est elle qui déplace réellement la page,
  // et les trois enveloppes s'appuient dessus. La prendre après reviendrait à
  // s'appeler soi-même.
  const native = objet.scrollTo as ((x: number, y: number) => void) | undefined;
  const poser: Poseur = (cible, x, y) => {
    if (typeof native === "function") native.call(cible, x, y);
  };

  // `scroll` est l'alias historique de `scrollTo` — même défaut, même correctif.
  for (const nom of ["scrollTo", "scroll"]) {
    if (!accepteUnObjet(fenetre, nom)) objet[nom] = creerScrollTo(poser);
  }
  if (!accepteUnObjet(fenetre, "scrollBy")) objet.scrollBy = creerScrollBy(poser);
}

export function installerPolyfillDefilement(): void {
  if (typeof Element !== "undefined") installerSurElement();
  if (typeof window !== "undefined") installerSurFenetre(window);
}
