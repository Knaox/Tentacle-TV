import { ATTRIBUT_ENTREE } from "../focus/zones";

/**
 * Désigner, dans un panneau du client web, l'option à viser en l'ouvrant.
 *
 * Ouvrir les réglages doit poser le focus sur la piste AUDIO en cours, et
 * ouvrir la liste des épisodes sur l'épisode qu'on regarde — c'est ce que fait
 * l'Apple TV, et c'est le seul point d'entrée qui n'oblige pas à parcourir la
 * liste pour retrouver où l'on en est. Mesuré avant correction : le focus
 * atterrissait sur la croix de fermeture, la seule chose du panneau qu'on ne
 * veuille pas viser en l'ouvrant.
 *
 * Et quand rien n'est actif — série jamais commencée, sous-titres coupés —,
 * c'est la PREMIÈRE option de la liste qui est visée, jamais la croix : voir le
 * repli d'`optionDEntree`.
 *
 * **Comment on reconnaît l'option active, et pourquoi pas par sa classe.** Le
 * panneau du web ne pose aucun ARIA : sa sélection est un habillage, et rien
 * d'autre. On pourrait donc chercher `bg-tentacle-accent/25` — mais c'est une
 * classe du système de design, qui peut être renommée sans que personne pense
 * au téléviseur. Le portage a déjà payé cette leçon sur les boutons de fiche.
 *
 * Et il se trouve qu'elle serait fausse : cette classe-là **ne peint rien**.
 * `tentacle-accent` est déclaré en `var(--brand)` brut, et Tailwind ne sait pas
 * appliquer un modificateur d'opacité à une variable — la classe part dans le
 * HTML, aucune règle ne la suit. Relevé sur la dalle de développement : la
 * feuille contient `.bg-tentacle-accent`, jamais sa variante `/25`. Chercher
 * une classe aurait donc désigné une option que rien ne distingue à l'écran.
 *
 * On lit donc le RÉSULTAT plutôt que le moyen, par deux signaux relevés dans
 * l'ordre :
 *
 * 1. **Un fond peint.** C'est la marque de la liste d'épisodes, dont la ligne
 *    courante porte `--brand-accent-soft`.
 * 2. **Une graisse appuyée.** C'est la marque des listes de pistes, où l'option
 *    active passe en 500 quand les autres restent en 400 — la seule part de son
 *    habillage qui arrive réellement à l'écran.
 *
 * Les deux survivent à n'importe quel renommage, tant que le panneau continue
 * de distinguer ce qui est sélectionné — ce qui est précisément l'objectif de
 * parité visuelle.
 *
 * La marque posée est `data-tv-zone-entree`, premier rang de la cascade de
 * `focus/zones.ts` — l'attribut prévu pour qu'une enveloppe du portage désigne
 * ce que sa zone veut voir viser. Un seul élément le porte à la fois.
 */

/** L'alpha d'une couleur calculée. Chrome 53 rend toujours la forme `rgb`/`rgba`. */
function opacite(couleur: string): number {
  if (!couleur || couleur === "transparent") return 0;
  const ouvrante = couleur.indexOf("(");
  if (ouvrante < 0) return 1;
  const composantes = couleur.slice(ouvrante + 1, couleur.lastIndexOf(")")).split(",");
  if (composantes.length < 4) return 1;
  const alpha = parseFloat(composantes[3]);
  return isNaN(alpha) ? 1 : alpha;
}

/**
 * Les signaux d'activité, du plus explicite au plus discret.
 *
 * Relevés dans l'ordre et non combinés : dans la liste d'épisodes, l'onglet de
 * la saison affichée est en graisse 500 lui aussi, et il vient avant la ligne
 * courante dans le document. Le fond, lui, n'appartient qu'à la ligne.
 */
const SIGNAUX: ((style: CSSStyleDeclaration) => boolean)[] = [
  (style) => opacite(style.backgroundColor) > 0.01,
  (style) => {
    const graisse = parseInt(style.fontWeight, 10);
    return !isNaN(graisse) && graisse >= 500;
  },
];

/**
 * Un bouton de LISTE, par opposition aux commandes de l'en-tête.
 *
 * Distinction structurelle, sans vocabulaire de design : les options vivent
 * dans la zone qui défile, la croix de fermeture n'en fait pas partie. C'est ce
 * qui permet au repli ci-dessous de ne jamais la désigner.
 */
function dansUneListe(bouton: HTMLElement, panneau: HTMLElement): boolean {
  for (let noeud = bouton.parentElement; noeud && panneau.contains(noeud); noeud = noeud.parentElement) {
    const debordement = window.getComputedStyle(noeud).overflowY;
    if (debordement === "auto" || debordement === "scroll") return true;
  }
  return false;
}

/**
 * L'option à viser en ouvrant : l'active, et à défaut la première de la liste.
 *
 * `retenir` restreint la recherche quand le panneau mêle plusieurs listes.
 *
 * Le repli n'est pas décoratif. Rien n'est actif dans une série jamais
 * commencée, ni dans une liste de sous-titres coupés ; la cascade de
 * `focus/zones.ts` retombait alors sur son dernier rang — le premier focusable
 * du panneau, c'est-à-dire la croix de fermeture. Ouvrir un menu pour y viser
 * le bouton qui le referme est la seule entrée qu'on ne veuille jamais.
 */
function optionDEntree(
  panneau: HTMLElement,
  retenir?: (bouton: HTMLElement) => boolean,
): HTMLElement | null {
  const options: HTMLElement[] = [];
  for (const bouton of panneau.querySelectorAll<HTMLElement>("button")) {
    if (!retenir || retenir(bouton)) options.push(bouton);
  }

  for (const signal of SIGNAUX) {
    for (const option of options) {
      if (signal(window.getComputedStyle(option))) return option;
    }
  }

  for (const option of options) {
    if (dansUneListe(option, panneau)) return option;
  }
  return null;
}

/**
 * Pose la marque d'entrée sur l'option active, et la retire de l'ancienne.
 *
 * Idempotent, comme l'exige `useMarqueur` : appelé à chaque mutation du
 * panneau, il n'écrit que lorsque la cible change.
 */
export function marquerEntreePanneau(
  panneau: HTMLElement,
  retenir?: (bouton: HTMLElement) => boolean,
): void {
  const ancienne = panneau.querySelector<HTMLElement>(`[${ATTRIBUT_ENTREE}]`);
  const voulue = optionDEntree(panneau, retenir);
  if (ancienne === voulue) return;
  if (ancienne) ancienne.removeAttribute(ATTRIBUT_ENTREE);
  if (voulue) voulue.setAttribute(ATTRIBUT_ENTREE, "");
}

/**
 * Une ligne d'épisode, distinguée d'un onglet de saison par sa vignette.
 *
 * Structurel et sans vocabulaire de design : une ligne d'épisode porte une
 * image, un onglet de saison n'en porte pas.
 */
export function estLigneEpisode(bouton: HTMLElement): boolean {
  return !!bouton.querySelector("img");
}
