/**
 * Ce que Chrome 53 ne sait pas lire, et qui ne doit donc pas survivre dans la
 * feuille finale.
 *
 * Données pures, consommées par `compatGuard`. C'est la seule protection
 * contre une régression introduite plus tard par quelqu'un qui ne pense pas au
 * téléviseur : la classe qu'il ajoute produit une primitive trop récente, et
 * le build échoue au lieu de livrer une page dont la géométrie s'effondre.
 *
 * Chaque entrée porte la version de Chromium où la primitive apparaît, et ce
 * qu'on perd concrètement à l'écran — sans cela, la tentation est grande de
 * retirer une entrée qui gêne.
 */

export interface ForbiddenPrimitive {
  name: string;
  since: number;
  consequence: string;
}

/** Propriétés dont la seule présence casse la mise en page. */
export const FORBIDDEN_DECLARATIONS: ForbiddenPrimitive[] = [
  {
    name: "grid-template-columns",
    since: 57,
    consequence: "la grille retombe en bloc, une seule affiche par ligne",
  },
  {
    name: "grid-template-rows",
    since: 57,
    consequence: "idem",
  },
  {
    name: "grid-column",
    since: 57,
    consequence: "l'élément ne couvre plus plusieurs colonnes",
  },
  {
    name: "grid-row",
    since: 57,
    consequence: "idem",
  },
  {
    name: "gap",
    since: 84,
    consequence: "tous les espacements de rangée disparaissent",
  },
  {
    name: "column-gap",
    since: 84,
    consequence: "idem, sur l'axe horizontal",
  },
  {
    name: "row-gap",
    since: 84,
    consequence: "idem, sur l'axe vertical",
  },
  {
    name: "aspect-ratio",
    since: 88,
    consequence: "les affiches ont une hauteur nulle",
  },
  {
    name: "backdrop-filter",
    since: 76,
    consequence: "sans effet, mais laisse croire à un verre qui n'existe pas",
  },
  {
    name: "content-visibility",
    since: 85,
    consequence: "sans effet",
  },
  {
    name: "contain-intrinsic-size",
    since: 85,
    consequence: "sans effet",
  },
];

/** Valeurs de propriété qui invalident la déclaration qui les porte. */
export const FORBIDDEN_VALUES: ForbiddenPrimitive[] = [
  // Les trois variantes du viewport dynamique — Chrome 108, donc absentes
  // jusqu'à webOS 23 incluse. Elles n'étaient pas au catalogue et sortaient
  // dans la feuille livrée (`.min-h-dvh{min-height:100dvh}`) : la déclaration
  // entière y était ignorée, et l'écran perdait sa hauteur sur une génération
  // et pas sur l'autre. `fixedUnitsPass` les résout désormais en pixels ;
  // celles qui lui échappent doivent faire échouer le build.
  { name: "dvh", since: 108, consequence: "la declaration entiere est ignoree — l'ecran perd sa hauteur" },
  { name: "svh", since: 108, consequence: "la declaration entiere est ignoree — l'ecran perd sa hauteur" },
  { name: "lvh", since: 108, consequence: "la declaration entiere est ignoree — l'ecran perd sa hauteur" },
  { name: "dvw", since: 108, consequence: "la declaration entiere est ignoree — l'ecran perd sa largeur" },

  { name: "min(", since: 79, consequence: "la déclaration entière est ignorée" },
  { name: "max(", since: 79, consequence: "idem" },
  { name: "clamp(", since: 79, consequence: "idem" },
  { name: "color-mix(", since: 111, consequence: "idem" },
];

/** Pseudo-classes et pseudo-éléments qui invalident la règle entière. */
export const FORBIDDEN_SELECTORS: ForbiddenPrimitive[] = [
  {
    name: ":focus-visible",
    since: 86,
    consequence: "plus aucun anneau de focus — l'interface devient impilotable",
  },
  {
    name: ":where(",
    since: 88,
    consequence:
      "la règle entière tombe ; sur le preflight, les boutons reprennent le style natif du engine",
  },
  { name: ":is(", since: 88, consequence: "la règle entière tombe" },
  {
    name: ":has(",
    since: 105,
    consequence: "la règle entière tombe — et rien ne le signale à l'écran",
  },
];

/** `display: grid` reste détectable séparément : c'est une valeur, pas une propriété. */
export const FORBIDDEN_DISPLAYS = ["grid", "inline-grid"];
