import { CANEVAS, RACINE_REM } from "./canevas";

/**
 * Évalue une expression de longueur CSS contre le canevas fixe du téléviseur.
 *
 * Module PUR, séparé de la passe : c'est un petit évaluateur d'expressions, et
 * il mérite d'être éprouvé sur une table de cas plutôt qu'à travers PostCSS.
 *
 * La règle de conduite est unique et elle vaut mieux que tout le reste : **ce
 * qui n'est pas certain n'est pas résolu.** Une valeur non résoluble est rendue
 * telle quelle, et c'est alors `gardeCompat` qui décide s'il faut refuser le
 * build. Deviner produirait une mise en page plausible et fausse — le seul
 * défaut qu'on ne retrouve jamais.
 */

/** Ce qu'on sait convertir en pixels sans rien connaître du contexte. */
const UNITES: Record<string, number> = {
  px: 1,
  rem: RACINE_REM,
  vw: CANEVAS.largeur / 100,
  vh: CANEVAS.hauteur / 100,
  vmin: Math.min(CANEVAS.largeur, CANEVAS.hauteur) / 100,
  vmax: Math.max(CANEVAS.largeur, CANEVAS.hauteur) / 100,
  // Une application n'a ni barre d'URL ni barre d'outils escamotable : les trois
  // variantes du viewport dynamique valent le viewport tout court.
  dvw: CANEVAS.largeur / 100,
  svw: CANEVAS.largeur / 100,
  lvw: CANEVAS.largeur / 100,
  dvh: CANEVAS.hauteur / 100,
  svh: CANEVAS.hauteur / 100,
  lvh: CANEVAS.hauteur / 100,
};

/**
 * Ce qui rend une expression NON résoluble, et pourquoi chacun est irréductible.
 *
 * `%` se rapporte au bloc conteneur, `em` à la police de l'élément, `var()` à
 * une cascade qu'on ne connaît qu'à l'exécution, `env()` au matériel, `ch` et
 * `ex` aux métriques de la fonte chargée. Aucun n'est connu ici.
 */
const IRREDUCTIBLES = /(^|[\s(,])-?[\d.]+(%|em|ch|ex|cap|ic|lh)\b|var\(|env\(|attr\(/;

/**
 * Rend la valeur résolue en pixels, ou `null` si elle ne l'est pas.
 *
 * Accepte une expression complète — `clamp(2rem, 4.2vw, 3.5rem)`,
 * `calc(100vh - 64px)`, `min(100vw, 40rem)` — et les imbrications entre elles.
 */
export function evaluerLongueur(valeur: string): number | null {
  const texte = valeur.trim();
  if (texte.length === 0 || IRREDUCTIBLES.test(texte)) return null;
  try {
    const lecteur = new Lecteur(texte);
    const resultat = lecteur.expression();
    return lecteur.fini() && Number.isFinite(resultat) ? resultat : null;
  } catch {
    return null;
  }
}

/** La même chose, rendue en chaîne CSS — `null` si non résoluble. */
export function resoudreLongueur(valeur: string): string | null {
  const pixels = evaluerLongueur(valeur);
  if (pixels === null) return null;
  // Arrondi au centième : au-delà, on écrit du bruit binaire dans la feuille.
  const arrondi = Math.round(pixels * 100) / 100;
  return `${arrondi}px`;
}

/**
 * Un analyseur descendant, le plus petit qui fasse le travail.
 *
 * Grammaire : somme → produit → terme, plus les trois fonctions. `calc()` n'y
 * est qu'un jeu de parenthèses de plus — c'est exactement ce que dit la
 * spécification.
 */
class Lecteur {
  private i = 0;

  constructor(private readonly texte: string) {}

  fini(): boolean {
    this.espaces();
    return this.i >= this.texte.length;
  }

  expression(): number {
    let gauche = this.produit();
    for (;;) {
      this.espaces();
      const signe = this.texte[this.i];
      if (signe !== "+" && signe !== "-") return gauche;
      // En CSS, `+` et `-` DOIVENT être entourés d'espaces dans un `calc()` —
      // sans quoi `-4px` serait un nombre signé. On s'appuie sur la même règle.
      if (!/\s/.test(this.texte[this.i - 1] ?? "")) return gauche;
      this.i += 1;
      const droite = this.produit();
      gauche = signe === "+" ? gauche + droite : gauche - droite;
    }
  }

  private produit(): number {
    let gauche = this.terme();
    for (;;) {
      this.espaces();
      const signe = this.texte[this.i];
      if (signe !== "*" && signe !== "/") return gauche;
      this.i += 1;
      const droite = this.terme();
      if (signe === "/" && droite === 0) throw new Error("division par zéro");
      gauche = signe === "*" ? gauche * droite : gauche / droite;
    }
  }

  private terme(): number {
    this.espaces();
    if (this.texte[this.i] === "(") {
      this.i += 1;
      const valeur = this.expression();
      this.attendre(")");
      return valeur;
    }
    const fonction = /^(calc|clamp|min|max)\(/i.exec(this.texte.slice(this.i));
    if (fonction) {
      this.i += fonction[0].length;
      const args = this.arguments_();
      return appliquer(fonction[1].toLowerCase(), args);
    }
    return this.nombre();
  }

  private arguments_(): number[] {
    const valeurs: number[] = [];
    for (;;) {
      valeurs.push(this.expression());
      this.espaces();
      if (this.texte[this.i] === ",") {
        this.i += 1;
        continue;
      }
      this.attendre(")");
      return valeurs;
    }
  }

  private nombre(): number {
    this.espaces();
    const trouve = /^[+-]?(\d+\.?\d*|\.\d+)([a-z]*)/i.exec(this.texte.slice(this.i));
    if (!trouve) throw new Error(`nombre attendu : ${this.texte.slice(this.i, this.i + 12)}`);
    this.i += trouve[0].length;
    const brut = Number(trouve[1]) * (trouve[0].startsWith("-") ? -1 : 1);
    const unite = trouve[2].toLowerCase();
    // Un nombre nu est légitime : c'est un facteur de `calc(… * 2)`, ou le zéro
    // que CSS autorise sans unité.
    if (unite.length === 0) return brut;
    const facteur = UNITES[unite];
    if (facteur === undefined) throw new Error(`unité inconnue : ${unite}`);
    return brut * facteur;
  }

  private attendre(caractere: string): void {
    this.espaces();
    if (this.texte[this.i] !== caractere) throw new Error(`« ${caractere} » attendu`);
    this.i += 1;
  }

  private espaces(): void {
    while (this.i < this.texte.length && /\s/.test(this.texte[this.i])) this.i += 1;
  }
}

function appliquer(nom: string, args: number[]): number {
  if (nom === "calc") {
    if (args.length !== 1) throw new Error("calc() prend un seul argument");
    return args[0];
  }
  if (nom === "clamp") {
    if (args.length !== 3) throw new Error("clamp() prend trois arguments");
    const [plancher, voulu, plafond] = args;
    return Math.max(plancher, Math.min(voulu, plafond));
  }
  if (args.length === 0) throw new Error(`${nom}() sans argument`);
  return nom === "min" ? Math.min(...args) : Math.max(...args);
}
