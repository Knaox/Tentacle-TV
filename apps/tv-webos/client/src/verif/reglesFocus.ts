import { recenser, type Candidat } from "../focus/candidats";
import { boiteDepuisRectangle, meilleur } from "../focus/geometrie";
import { scrollerHorizontal, scrollerVertical } from "../focus/defilement";
import type { Direction } from "../focus/touches";

/**
 * Ce qu'on peut vérifier sans un œil humain.
 *
 * Les règles de navigation d'un téléviseur se cassent en silence : un
 * `tabIndex` ajouté demain dans `apps/web`, une carte qui déborde de sa piste,
 * un anneau rogné par un `overflow` — rien de tout cela n'échoue au build, et on
 * ne s'en aperçoit qu'une télécommande à la main, trois semaines plus tard.
 *
 * Ce module lit l'écran tel qu'il est et rend la liste de ce qui cloche. Il
 * n'affiche rien : la surcouche de débogage l'utilise, et on peut aussi
 * l'appeler depuis une console. **Il n'est jamais compilé en production** —
 * `__TV_DEBUG__` vaut faux et l'élimination de code mort l'emporte tout entier.
 *
 * Deux vérifications déplacent réellement le focus — l'anneau et les impasses —
 * parce qu'aucune ne se déduit du style calculé au repos. L'état d'origine est
 * restitué à la fin.
 */

export type Gravite = "erreur" | "avertissement";

export interface Manquement {
  regle: string;
  gravite: Gravite;
  element: string;
  detail: string;
}

/** Zone sûre : 5 % de chaque bord, comme `--tv-overscan-*`. */
const MARGE_SURE_X = 0.05;
const MARGE_SURE_Y = 0.05;

const DIRECTIONS: Direction[] = ["haut", "bas", "gauche", "droite"];

/**
 * Ce qui a le droit d'être atteignable.
 *
 * Tout le reste est du texte, une image ou un conteneur : le focus n'a rien à y
 * faire, et l'anneau qui s'y pose n'annonce aucune action.
 */
const ROLES_ACTIONNABLES = new Set([
  "button",
  "link",
  "tab",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "option",
  "checkbox",
  "radio",
  "switch",
  "slider",
  "textbox",
  "searchbox",
  "combobox",
]);

const BALISES_ACTIONNABLES = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);

export function verifierEcran(): Manquement[] {
  const candidats = recenser(document);
  const manquements: Manquement[] = [];
  const origine = document.activeElement as HTMLElement | null;

  for (const candidat of candidats) {
    manquements.push(...verifierNature(candidat));
    manquements.push(...verifierZoneSure(candidat));
    manquements.push(...verifierRognage(candidat));
    manquements.push(...verifierAnneau(candidat));
    manquements.push(...verifierImpasses(candidat, candidats));
  }

  if (origine && origine.isConnected) origine.focus();
  else if (candidats.length > 0) candidats[0].element.focus();

  return manquements;
}

/** De quoi désigner l'élément dans un rapport, sans ambiguïté. */
export function decrire(element: HTMLElement): string {
  const texte = (element.getAttribute("aria-label") || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return `${element.tagName}${texte ? ` « ${texte} »` : ""}`;
}

function verifierNature(candidat: Candidat): Manquement[] {
  const element = candidat.element;
  if (BALISES_ACTIONNABLES.has(element.tagName)) return [];
  if (element.hasAttribute("data-tv-carte")) return [];

  const role = element.getAttribute("role");
  if (role && ROLES_ACTIONNABLES.has(role)) return [];

  return [
    {
      regle: "seuls-les-actionnables",
      gravite: "erreur",
      element: decrire(element),
      detail:
        "Atteignable sans être un contrôle : ni balise interactive, ni rôle actionnable, ni carte. " +
        "Un anneau s'y posera sans annoncer d'action.",
    },
  ];
}

function verifierZoneSure(candidat: Candidat): Manquement[] {
  const { boite } = candidat;
  const margeX = window.innerWidth * MARGE_SURE_X;
  const margeY = window.innerHeight * MARGE_SURE_Y;

  // La zone sûre ne se juge que sur ce qui est ENTIÈREMENT à l'écran.
  //
  // Une carte qui dépasse le bas du viewport n'est pas dans la bande que la
  // dalle rogne : elle est hors champ, et le défilement l'amènera. Sans cette
  // distinction, chaque grille rendait une ligne de manquements par carte sous
  // la ligne de flottaison — du bruit qui noie les vrais.
  const dansLEcranVerticalement = boite.haut >= 0 && boite.bas <= window.innerHeight;
  const dansLEcranHorizontalement = boite.gauche >= 0 && boite.droite <= window.innerWidth;

  const debords: string[] = [];
  if (dansLEcranHorizontalement) {
    if (boite.gauche < margeX) {
      debords.push(`gauche ${Math.round(boite.gauche)} < ${Math.round(margeX)}`);
    }
    if (boite.droite > window.innerWidth - margeX) {
      debords.push(`droite ${Math.round(boite.droite)} > ${Math.round(window.innerWidth - margeX)}`);
    }
  }
  if (dansLEcranVerticalement) {
    if (boite.haut < margeY) debords.push(`haut ${Math.round(boite.haut)} < ${Math.round(margeY)}`);
    if (boite.bas > window.innerHeight - margeY) {
      debords.push(`bas ${Math.round(boite.bas)} > ${Math.round(window.innerHeight - margeY)}`);
    }
  }

  if (debords.length === 0) return [];
  return [
    {
      regle: "zone-sure",
      gravite: "avertissement",
      element: decrire(candidat.element),
      detail: `Dans les 5 % que la dalle peut rogner : ${debords.join(", ")}.`,
    },
  ];
}

function verifierRognage(candidat: Candidat): Manquement[] {
  const element = candidat.element;
  const scroller = scrollerHorizontal(element) ?? scrollerVertical(element);
  if (!scroller) return [];

  const style = window.getComputedStyle(scroller);
  if (style.overflowX !== "hidden" && style.overflowY !== "hidden") return [];

  const boite = element.getBoundingClientRect();
  const cadre = scroller.getBoundingClientRect();
  // Sept pixels : l'épaisseur de l'anneau plus son écart.
  const anneau = 7;

  const rogne =
    boite.left - anneau < cadre.left - 1 ||
    boite.right + anneau > cadre.right + 1 ||
    boite.top - anneau < cadre.top - 1 ||
    boite.bottom + anneau > cadre.bottom + 1;

  if (!rogne) return [];
  return [
    {
      regle: "anneau-rogne",
      gravite: "avertissement",
      element: decrire(element),
      detail: "L'anneau dépasse d'un conteneur qui coupe : il sera partiellement invisible.",
    },
  ];
}

function verifierAnneau(candidat: Candidat): Manquement[] {
  // Sans le focus SYSTÈME, `:focus` ne matche jamais : `activeElement` change
  // bien, mais aucune règle de focus ne s'applique et aucun événement ne part.
  // Vérifier l'anneau dans cet état ne mesurerait que l'état de la fenêtre —
  // et rendrait un manquement pour chaque cible de l'écran. On se tait.
  if (!document.hasFocus()) return [];

  const element = candidat.element;
  element.focus();
  const style = window.getComputedStyle(element);
  const epaisseur = Number.parseFloat(style.outlineWidth) || 0;
  const invisible = style.outlineStyle === "none" || epaisseur < 2;

  if (!invisible) return [];
  return [
    {
      regle: "anneau-visible",
      gravite: "erreur",
      element: decrire(element),
      detail: `Aucun anneau au focus (outline ${style.outlineStyle} ${style.outlineWidth}).`,
    },
  ];
}

function verifierImpasses(candidat: Candidat, tous: Candidat[]): Manquement[] {
  const autres = tous.filter((autre) => autre.element !== candidat.element);
  const sansIssue = DIRECTIONS.filter(
    (direction) =>
      !auBordDeLEcran(candidat, direction) && meilleur(candidat.boite, autres, direction) === null,
  );

  // Les quatre directions vides : l'élément est seul à l'écran, ce qui est un
  // état légitime — un écran d'erreur, une liste vide. Le manquement, c'est
  // d'être coincé alors qu'il y a un ailleurs.
  if (sansIssue.length === 0 || sansIssue.length === 4) return [];

  return [
    {
      regle: "impasse",
      gravite: "avertissement",
      element: decrire(candidat.element),
      detail: `Aucune destination vers : ${sansIssue.join(", ")}.`,
    },
  ];
}

/**
 * Le bord de l'écran n'est pas une impasse, c'est une fin.
 *
 * La règle demande qu'aucune direction ne mène nulle part « sauf blocage
 * volontaire et documenté ». Le rail à gauche de l'écran, la première rangée en
 * haut, la dernière carte d'une ligne de grille : ces butées sont voulues, et
 * les signaler noierait les vraies impasses sous le bruit. On les reconnaît à
 * ce qu'elles sont — l'élément touche déjà la zone sûre de ce côté-là.
 */
function auBordDeLEcran(candidat: Candidat, direction: Direction): boolean {
  const margeX = window.innerWidth * MARGE_SURE_X;
  const margeY = window.innerHeight * MARGE_SURE_Y;
  const { boite } = candidat;

  switch (direction) {
    case "gauche":
      return boite.gauche <= margeX + 1;
    case "droite":
      return boite.droite >= window.innerWidth - margeX - 1;
    case "haut":
      return boite.haut <= margeY + 1;
    case "bas":
      return boite.bas >= window.innerHeight - margeY - 1;
  }
}

/** Rappel de la géométrie, pour dessiner la surcouche. */
export function rectanglesFocusables(): Array<{ element: HTMLElement; rect: DOMRect }> {
  return recenser(document).map((candidat) => ({
    element: candidat.element,
    rect: candidat.element.getBoundingClientRect(),
  }));
}

export { boiteDepuisRectangle };
