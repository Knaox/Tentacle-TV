/**
 * Ce que Chrome 53 ne sait pas lire, et qui ne doit donc pas survivre dans la
 * feuille finale.
 *
 * Données pures, consommées par `gardeCompat`. C'est la seule protection
 * contre une régression introduite plus tard par quelqu'un qui ne pense pas au
 * téléviseur : la classe qu'il ajoute produit une primitive trop récente, et
 * le build échoue au lieu de livrer une page dont la géométrie s'effondre.
 *
 * Chaque entrée porte la version de Chromium où la primitive apparaît, et ce
 * qu'on perd concrètement à l'écran — sans cela, la tentation est grande de
 * retirer une entrée qui gêne.
 */

export interface PrimitiveInterdite {
  nom: string;
  depuis: number;
  consequence: string;
}

/** Propriétés dont la seule présence casse la mise en page. */
export const DECLARATIONS_INTERDITES: PrimitiveInterdite[] = [
  {
    nom: "grid-template-columns",
    depuis: 57,
    consequence: "la grille retombe en bloc, une seule affiche par ligne",
  },
  {
    nom: "grid-template-rows",
    depuis: 57,
    consequence: "idem",
  },
  {
    nom: "grid-column",
    depuis: 57,
    consequence: "l'élément ne couvre plus plusieurs colonnes",
  },
  {
    nom: "grid-row",
    depuis: 57,
    consequence: "idem",
  },
  {
    nom: "gap",
    depuis: 84,
    consequence: "tous les espacements de rangée disparaissent",
  },
  {
    nom: "column-gap",
    depuis: 84,
    consequence: "idem, sur l'axe horizontal",
  },
  {
    nom: "row-gap",
    depuis: 84,
    consequence: "idem, sur l'axe vertical",
  },
  {
    nom: "aspect-ratio",
    depuis: 88,
    consequence: "les affiches ont une hauteur nulle",
  },
  {
    nom: "backdrop-filter",
    depuis: 76,
    consequence: "sans effet, mais laisse croire à un verre qui n'existe pas",
  },
  {
    nom: "content-visibility",
    depuis: 85,
    consequence: "sans effet",
  },
  {
    nom: "contain-intrinsic-size",
    depuis: 85,
    consequence: "sans effet",
  },
];

/** Valeurs de propriété qui invalident la déclaration qui les porte. */
export const VALEURS_INTERDITES: PrimitiveInterdite[] = [
  { nom: "min(", depuis: 79, consequence: "la déclaration entière est ignorée" },
  { nom: "max(", depuis: 79, consequence: "idem" },
  { nom: "clamp(", depuis: 79, consequence: "idem" },
  { nom: "color-mix(", depuis: 111, consequence: "idem" },
];

/** Pseudo-classes et pseudo-éléments qui invalident la règle entière. */
export const SELECTEURS_INTERDITS: PrimitiveInterdite[] = [
  {
    nom: ":focus-visible",
    depuis: 86,
    consequence: "plus aucun anneau de focus — l'interface devient impilotable",
  },
  {
    nom: ":where(",
    depuis: 88,
    consequence:
      "la règle entière tombe ; sur le preflight, les boutons reprennent le style natif du moteur",
  },
  { nom: ":is(", depuis: 88, consequence: "la règle entière tombe" },
  {
    nom: ":has(",
    depuis: 105,
    consequence: "la règle entière tombe — et rien ne le signale à l'écran",
  },
];

/** `display: grid` reste détectable séparément : c'est une valeur, pas une propriété. */
export const AFFICHAGES_INTERDITS = ["grid", "inline-grid"];
