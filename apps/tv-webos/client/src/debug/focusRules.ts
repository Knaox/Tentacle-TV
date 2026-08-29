import { collect, type Candidate } from "../focus/candidates";
import { boxFromRect, best } from "@tentacle-tv/tv-core";
import { horizontalScroller, verticalScroller } from "../focus/scroll";
import type { Direction } from "../focus/keys";

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

export type Severity = "erreur" | "avertissement";

export interface Violation {
  rule: string;
  severity: Severity;
  element: string;
  detail: string;
}

/** Zone sûre : 5 % de chaque bord, comme `--tv-overscan-*`. */
const SAFE_MARGIN_X = 0.05;
const SAFE_MARGIN_Y = 0.05;

const DIRECTIONS: Direction[] = ["haut", "bas", "gauche", "droite"];

/**
 * Ce qui a le droit d'être atteignable.
 *
 * Tout le reste est du texte, une image ou un conteneur : le focus n'a rien à y
 * faire, et l'anneau qui s'y pose n'annonce aucune action.
 */
const ACTIONABLE_ROLES = new Set([
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

const ACTIONABLE_TAGS = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);

export function checkScreen(): Violation[] {
  const candidates = collect(document);
  const violations: Violation[] = [];
  const origin = document.activeElement as HTMLElement | null;

  for (const candidate of candidates) {
    violations.push(...checkNature(candidate));
    violations.push(...checkSafeZone(candidate));
    violations.push(...checkClipping(candidate));
    violations.push(...checkRing(candidate));
    violations.push(...checkDeadEnds(candidate, candidates));
  }

  if (origin && origin.isConnected) origin.focus();
  else if (candidates.length > 0) candidates[0].element.focus();

  return violations;
}

/** De quoi désigner l'élément dans un rapport, sans ambiguïté. */
export function describeIt(element: HTMLElement): string {
  const text = (element.getAttribute("aria-label") || element.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32);
  return `${element.tagName}${text ? ` « ${text} »` : ""}`;
}

function checkNature(candidate: Candidate): Violation[] {
  const element = candidate.element;
  if (ACTIONABLE_TAGS.has(element.tagName)) return [];
  if (element.hasAttribute("data-tv-carte")) return [];

  const role = element.getAttribute("role");
  if (role && ACTIONABLE_ROLES.has(role)) return [];

  return [
    {
      rule: "seuls-les-actionnables",
      severity: "erreur",
      element: describeIt(element),
      detail:
        "Atteignable sans être un contrôle : ni balise interactive, ni rôle actionnable, ni carte. " +
        "Un anneau s'y posera sans annoncer d'action.",
    },
  ];
}

function checkSafeZone(candidate: Candidate): Violation[] {
  const { box } = candidate;
  const marginX = window.innerWidth * SAFE_MARGIN_X;
  const marginY = window.innerHeight * SAFE_MARGIN_Y;

  // La zone sûre ne se juge que sur ce qui est ENTIÈREMENT à l'écran.
  //
  // Une carte qui dépasse le bas du viewport n'est pas dans la bande que la
  // dalle rogne : elle est hors champ, et le défilement l'amènera. Sans cette
  // distinction, chaque grille rendait une ligne de manquements par carte sous
  // la ligne de flottaison — du bruit qui noie les vrais.
  const inScreenVertically = box.top >= 0 && box.bottom <= window.innerHeight;
  const inScreenHorizontally = box.left >= 0 && box.right <= window.innerWidth;

  const overflows: string[] = [];
  if (inScreenHorizontally) {
    if (box.left < marginX) {
      overflows.push(`gauche ${Math.round(box.left)} < ${Math.round(marginX)}`);
    }
    if (box.right > window.innerWidth - marginX) {
      overflows.push(`droite ${Math.round(box.right)} > ${Math.round(window.innerWidth - marginX)}`);
    }
  }
  if (inScreenVertically) {
    if (box.top < marginY) overflows.push(`haut ${Math.round(box.top)} < ${Math.round(marginY)}`);
    if (box.bottom > window.innerHeight - marginY) {
      overflows.push(`bas ${Math.round(box.bottom)} > ${Math.round(window.innerHeight - marginY)}`);
    }
  }

  if (overflows.length === 0) return [];
  return [
    {
      rule: "zone-sure",
      severity: "avertissement",
      element: describeIt(candidate.element),
      detail: `Dans les 5 % que la dalle peut rogner : ${overflows.join(", ")}.`,
    },
  ];
}

function checkClipping(candidate: Candidate): Violation[] {
  const element = candidate.element;
  const scroller = horizontalScroller(element) ?? verticalScroller(element);
  if (!scroller) return [];

  const style = window.getComputedStyle(scroller);
  if (style.overflowX !== "hidden" && style.overflowY !== "hidden") return [];

  const box = element.getBoundingClientRect();
  const frame = scroller.getBoundingClientRect();
  // Sept pixels : l'épaisseur de l'anneau plus son écart.
  const ring = 7;

  const clipped =
    box.left - ring < frame.left - 1 ||
    box.right + ring > frame.right + 1 ||
    box.top - ring < frame.top - 1 ||
    box.bottom + ring > frame.bottom + 1;

  if (!clipped) return [];
  return [
    {
      rule: "anneau-rogne",
      severity: "avertissement",
      element: describeIt(element),
      detail: "L'anneau dépasse d'un conteneur qui coupe : il sera partiellement invisible.",
    },
  ];
}

function checkRing(candidate: Candidate): Violation[] {
  // Sans le focus SYSTÈME, `:focus` ne matche jamais : `activeElement` change
  // bien, mais aucune règle de focus ne s'applique et aucun événement ne part.
  // Vérifier l'anneau dans cet état ne mesurerait que l'état de la fenêtre —
  // et rendrait un manquement pour chaque cible de l'écran. On se tait.
  if (!document.hasFocus()) return [];

  const element = candidate.element;
  element.focus();
  const style = window.getComputedStyle(element);

  // L'anneau est un `box-shadow` depuis que l'outline s'est révélée incapable
  // d'épouser un rayon en Chrome 53. La règle suit : elle accepte l'un OU
  // l'autre, parce qu'une carte porte le sien sur la boîte de son affiche —
  // un pseudo-élément descendant, hors de portée d'un `getComputedStyle` sur
  // l'élément focalisé. Mesurer l'ombre du descendant supposerait de connaître
  // la structure des cartes ; on se contente ici de constater qu'un signal
  // existe, et le rognage a sa propre règle juste au-dessus.
  const outlineThickness = Number.parseFloat(style.outlineWidth) || 0;
  const outlineVisible = style.outlineStyle !== "none" && outlineThickness >= 2;
  const shadowVisible = style.boxShadow !== "none" && style.boxShadow !== "";
  const carriedByDescendant = !!element.querySelector(".media-tile");

  if (outlineVisible || shadowVisible || carriedByDescendant) return [];
  return [
    {
      rule: "anneau-visible",
      severity: "erreur",
      element: describeIt(element),
      detail: `Aucun anneau au focus (outline ${style.outlineStyle} ${style.outlineWidth}, ombre ${style.boxShadow}).`,
    },
  ];
}

function checkDeadEnds(candidate: Candidate, all: Candidate[]): Violation[] {
  const others = all.filter((other) => other.element !== candidate.element);
  const deadEnds = DIRECTIONS.filter(
    (direction) =>
      !atScreenEdge(candidate, direction) && best(candidate.box, others, direction) === null,
  );

  // Les quatre directions vides : l'élément est seul à l'écran, ce qui est un
  // état légitime — un écran d'erreur, une liste vide. Le manquement, c'est
  // d'être coincé alors qu'il y a un ailleurs.
  if (deadEnds.length === 0 || deadEnds.length === 4) return [];

  return [
    {
      rule: "impasse",
      severity: "avertissement",
      element: describeIt(candidate.element),
      detail: `Aucune destination vers : ${deadEnds.join(", ")}.`,
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
function atScreenEdge(candidate: Candidate, direction: Direction): boolean {
  const marginX = window.innerWidth * SAFE_MARGIN_X;
  const marginY = window.innerHeight * SAFE_MARGIN_Y;
  const { box } = candidate;

  switch (direction) {
    case "gauche":
      return box.left <= marginX + 1;
    case "droite":
      return box.right >= window.innerWidth - marginX - 1;
    case "haut":
      return box.top <= marginY + 1;
    case "bas":
      return box.bottom >= window.innerHeight - marginY - 1;
  }
}

/** Rappel de la géométrie, pour dessiner la surcouche. */
export function focusableRects(): Array<{ element: HTMLElement; rect: DOMRect }> {
  return collect(document).map((candidate) => ({
    element: candidate.element,
    rect: candidate.element.getBoundingClientRect(),
  }));
}

export { boxFromRect };
