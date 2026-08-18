/**
 * Les deux observateurs, complétés chacun là où le socle s'arrête.
 *
 * ── `IntersectionObserverEntry.isIntersecting` — Chrome 58 ──
 *
 * L'observateur d'intersection, lui, existe depuis Chrome 51. C'est ce décalage
 * qui rend le défaut invisible : toutes les gardes `typeof IntersectionObserver
 * === "function"` du dépôt répondent oui, aucun repli ne se déclenche, et
 * l'attribut vaut pourtant `undefined` — donc faux — à chaque notification.
 *
 * La conséquence n'est pas cosmétique. `useInViewport` bascule à faux au
 * premier rappel et n'en revient jamais : le carrousel s'arrête, le halo n'est
 * plus monté, les squelettes d'images ne s'affichent plus. `RowTv` n'ouvre
 * jamais sa porte de montage, donc **aucune rangée n'a de cartes**. Et
 * `revealObserver` démonte les huit épisodes rendus d'avance. Un accueil vide,
 * pour un attribut manquant.
 *
 * Le corriger sur le prototype plutôt que chez les appelants n'est pas une
 * commodité : les appelants sont dans `apps/web`, que cette cible ne modifie
 * pas. Un accesseur ici répare `useInViewport`, `useNearViewport`,
 * `revealObserver`, `RowTv`, `HeroBillboard`, `DetailHero` et `LibraryHero`
 * d'un seul geste — et ceux qu'on écrira demain sans y penser.
 *
 * Réserve connue : un élément d'aire nulle qui touche la racine a un ratio de
 * zéro alors que le vrai attribut vaut vrai. Aucune des cartes, rangées ou
 * bannières observées ici n'est dans ce cas.
 *
 * ── `ResizeObserver` — Chrome 64 ──
 *
 * Six points d'`apps/web` s'en servent, tous pour la même chose : connaître la
 * largeur réelle d'une rangée ou d'une carte pour décider combien d'éléments
 * monter. Sans lui, `useRowCardWidth` ne rend jamais de largeur et le
 * fenêtrage des rangées bascule sur « tout rendre » — c'est-à-dire cent vingt
 * cartes montées sur l'accueil d'un processeur de téléviseur.
 *
 * L'implémentation compare les dimensions à intervalle plutôt que d'observer
 * le rendu. C'est un choix, pas un pis-aller : sur une dalle, la fenêtre a une
 * taille fixe et les seuls changements viennent de l'arrivée du contenu. Une
 * boucle `requestAnimationFrame` tournerait à soixante hertz pour observer un
 * événement qui survient trois fois par écran ; un intervalle de deux cents
 * millisecondes le voit tout aussi bien, sans réveiller le compositeur.
 *
 * L'intervalle ne tourne que tant qu'au moins un élément est observé.
 */

const PERIODE_MS = 200;

interface Dimensions {
  largeur: number;
  hauteur: number;
}

/**
 * La boîte de **contenu**, telle que le vrai observateur la livre.
 *
 * `getBoundingClientRect` rend la boîte de bordure. La différence n'est pas
 * théorique : `useItemsPerRow` observe le conteneur de la grille de
 * bibliothèque, qui porte `px-4 md:px-8` — soit soixante-quatre pixels de
 * padding surestimés, et un basculement de colonne sur deux frontières.
 */
interface RectangleContenu {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

type RappelObservation = (
  entrees: Array<{ target: Element; contentRect: RectangleContenu }>,
  observateur: ObservateurTaille,
) => void;

class ObservateurTaille {
  private readonly observes = new Map<Element, Dimensions>();
  private minuteur: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly rappel: RappelObservation) {}

  observe(cible: Element): void {
    if (this.observes.has(cible)) return;
    this.observes.set(cible, mesurer(cible));
    this.demarrer();
    // Première notification immédiate : le vrai ResizeObserver livre toujours
    // une entrée initiale, et les appelants s'y fient pour leur premier calcul.
    this.notifier([cible]);
  }

  unobserve(cible: Element): void {
    this.observes.delete(cible);
    if (this.observes.size === 0) this.arreter();
  }

  disconnect(): void {
    this.observes.clear();
    this.arreter();
  }

  private demarrer(): void {
    if (this.minuteur !== null) return;
    this.minuteur = setInterval(() => this.verifier(), PERIODE_MS);
  }

  private arreter(): void {
    if (this.minuteur === null) return;
    clearInterval(this.minuteur);
    this.minuteur = null;
  }

  private verifier(): void {
    const changes: Element[] = [];
    for (const [cible, precedentes] of this.observes) {
      const actuelles = mesurer(cible);
      if (actuelles.largeur === precedentes.largeur && actuelles.hauteur === precedentes.hauteur) {
        continue;
      }
      this.observes.set(cible, actuelles);
      changes.push(cible);
    }
    if (changes.length > 0) this.notifier(changes);
  }

  private notifier(cibles: Element[]): void {
    this.rappel(
      cibles.map((target) => ({ target, contentRect: boiteDeContenu(target) })),
      this,
    );
  }
}

function mesurer(cible: Element): Dimensions {
  const rectangle = cible.getBoundingClientRect();
  return { largeur: Math.round(rectangle.width), hauteur: Math.round(rectangle.height) };
}

function boiteDeContenu(cible: Element): RectangleContenu {
  const rectangle = cible.getBoundingClientRect();
  const style = window.getComputedStyle(cible);

  const gauche = pixels(style.paddingLeft);
  const haut = pixels(style.paddingTop);
  const horizontal = gauche + pixels(style.paddingRight)
    + pixels(style.borderLeftWidth) + pixels(style.borderRightWidth);
  const vertical = haut + pixels(style.paddingBottom)
    + pixels(style.borderTopWidth) + pixels(style.borderBottomWidth);

  const width = Math.max(0, rectangle.width - horizontal);
  const height = Math.max(0, rectangle.height - vertical);

  // L'origine du `contentRect` est relative à l'élément, pas à la fenêtre :
  // c'est le retrait supérieur gauche. Personne ne la lit ici, mais un
  // rectangle à moitié juste est plus coûteux qu'un rectangle entièrement faux.
  return {
    x: gauche,
    y: haut,
    width,
    height,
    left: gauche,
    top: haut,
    right: gauche + width,
    bottom: haut + height,
  };
}

function pixels(valeur: string): number {
  const nombre = parseFloat(valeur);
  return Number.isFinite(nombre) ? nombre : 0;
}

/**
 * Complète `IntersectionObserverEntry` là où le socle s'arrête.
 *
 * `configurable` : le prototype d'une interface native n'est pas scellé, mais
 * une définition non configurable interdirait à un vrai polyfill chargé plus
 * tard de reprendre la main.
 */
function completerEntreeIntersection(): void {
  const global = window as unknown as {
    IntersectionObserverEntry?: { prototype: object };
  };
  const Entree = global.IntersectionObserverEntry;
  if (!Entree || "isIntersecting" in Entree.prototype) return;

  Object.defineProperty(Entree.prototype, "isIntersecting", {
    configurable: true,
    get(this: { intersectionRatio: number }): boolean {
      return this.intersectionRatio > 0;
    },
  });
}

export function installerPolyfillObservateurs(): void {
  const global = window as unknown as Record<string, unknown>;
  if (typeof global.ResizeObserver !== "function") {
    global.ResizeObserver = ObservateurTaille;
  }
  completerEntreeIntersection();
}
