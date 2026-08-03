/**
 * `ResizeObserver` — Chrome 64.
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

type RappelObservation = (
  entrees: Array<{ target: Element; contentRect: DOMRectReadOnly }>,
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
      cibles.map((target) => ({ target, contentRect: target.getBoundingClientRect() })),
      this,
    );
  }
}

function mesurer(cible: Element): Dimensions {
  const rectangle = cible.getBoundingClientRect();
  return { largeur: Math.round(rectangle.width), hauteur: Math.round(rectangle.height) };
}

export function installerPolyfillObservateurs(): void {
  const global = window as unknown as Record<string, unknown>;
  if (typeof global.ResizeObserver !== "function") {
    global.ResizeObserver = ObservateurTaille;
  }
}
