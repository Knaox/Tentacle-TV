import { CANVAS, REM_ROOT } from "./canvas";

/**
 * Évalue une expression de longueur CSS contre le canvas fixe du téléviseur.
 *
 * Module PUR, séparé de la passe : c'est un petit évaluateur d'expressions, et
 * il mérite d'être éprouvé sur une table de cas plutôt qu'à travers PostCSS.
 *
 * La règle de conduite est unique et elle vaut mieux que tout le reste : **ce
 * qui n'est pas certain n'est pas résolu.** Une valeur non résoluble est rendue
 * telle quelle, et c'est alors `compatGuard` qui décide s'il faut refuser le
 * build. Deviner produirait une mise en page plausible et fausse — le seul
 * défaut qu'on ne retrouve jamais.
 */

/** Ce qu'on sait convertir en pixels sans rien connaître du context. */
const UNITS: Record<string, number> = {
  px: 1,
  rem: REM_ROOT,
  vw: CANVAS.width / 100,
  vh: CANVAS.height / 100,
  vmin: Math.min(CANVAS.width, CANVAS.height) / 100,
  vmax: Math.max(CANVAS.width, CANVAS.height) / 100,
  // Une application n'a ni barre d'URL ni barre d'outils escamotable : les trois
  // variantes du viewport dynamique valent le viewport tout court.
  dvw: CANVAS.width / 100,
  svw: CANVAS.width / 100,
  lvw: CANVAS.width / 100,
  dvh: CANVAS.height / 100,
  svh: CANVAS.height / 100,
  lvh: CANVAS.height / 100,
};

/**
 * Ce qui rend une expression NON résoluble, et pourquoi chacun est irréductible.
 *
 * `%` se rapporte au bloc conteneur, `em` à la police de l'élément, `var()` à
 * une cascade qu'on ne connaît qu'à l'exécution, `env()` au matériel, `ch` et
 * `ex` aux métriques de la fonte chargée. Aucun n'est connu ici.
 */
const IRREDUCIBLE = /(^|[\s(,])-?[\d.]+(%|em|ch|ex|cap|ic|lh)\b|var\(|env\(|attr\(/;

/**
 * Rend la valeur résolue en pixels, ou `null` si elle ne l'est pas.
 *
 * Accepte une expression complète — `clamp(2rem, 4.2vw, 3.5rem)`,
 * `calc(100vh - 64px)`, `min(100vw, 40rem)` — et les imbrications entre elles.
 */
export function evaluateLength(value: string): number | null {
  const text = value.trim();
  if (text.length === 0 || IRREDUCIBLE.test(text)) return null;
  try {
    const reader = new Reader(text);
    const result = reader.expression();
    return reader.fini() && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** La même chose, rendue en chaîne CSS — `null` si non résoluble. */
export function resolveLength(value: string): string | null {
  const pixels = evaluateLength(value);
  if (pixels === null) return null;
  // Arrondi au centième : au-delà, on écrit du bruit binaire dans la feuille.
  const rounded = Math.round(pixels * 100) / 100;
  return `${rounded}px`;
}

/**
 * Un analyseur descendant, le plus petit qui fasse le travail.
 *
 * Grammaire : somme → produit → terme, plus les trois fonctions. `calc()` n'y
 * est qu'un jeu de parenthèses de plus — c'est exactement ce que dit la
 * spécification.
 */
class Reader {
  private i = 0;

  constructor(private readonly text: string) {}

  fini(): boolean {
    this.spaces();
    return this.i >= this.text.length;
  }

  expression(): number {
    let left = this.produit();
    for (;;) {
      this.spaces();
      const sign = this.text[this.i];
      if (sign !== "+" && sign !== "-") return left;
      // En CSS, `+` et `-` DOIVENT être entourés d'espaces dans un `calc()` —
      // sans quoi `-4px` serait un nombre signé. On s'appuie sur la même règle.
      if (!/\s/.test(this.text[this.i - 1] ?? "")) return left;
      this.i += 1;
      const right = this.produit();
      left = sign === "+" ? left + right : left - right;
    }
  }

  private produit(): number {
    let left = this.terme();
    for (;;) {
      this.spaces();
      const sign = this.text[this.i];
      if (sign !== "*" && sign !== "/") return left;
      this.i += 1;
      const right = this.terme();
      if (sign === "/" && right === 0) throw new Error("division par zéro");
      left = sign === "*" ? left * right : left / right;
    }
  }

  private terme(): number {
    this.spaces();
    if (this.text[this.i] === "(") {
      this.i += 1;
      const value = this.expression();
      this.attendre(")");
      return value;
    }
    const fn = /^(calc|clamp|min|max)\(/i.exec(this.text.slice(this.i));
    if (fn) {
      this.i += fn[0].length;
      const args = this.arguments_();
      return apply(fn[1].toLowerCase(), args);
    }
    return this.number();
  }

  private arguments_(): number[] {
    const values: number[] = [];
    for (;;) {
      values.push(this.expression());
      this.spaces();
      if (this.text[this.i] === ",") {
        this.i += 1;
        continue;
      }
      this.attendre(")");
      return values;
    }
  }

  private number(): number {
    this.spaces();
    const found = /^[+-]?(\d+\.?\d*|\.\d+)([a-z]*)/i.exec(this.text.slice(this.i));
    if (!found) throw new Error(`nombre attendu : ${this.text.slice(this.i, this.i + 12)}`);
    this.i += found[0].length;
    const raw = Number(found[1]) * (found[0].startsWith("-") ? -1 : 1);
    const unit = found[2].toLowerCase();
    // Un nombre nu est légitime : c'est un facteur de `calc(… * 2)`, ou le zéro
    // que CSS autorise sans unité.
    if (unit.length === 0) return raw;
    const factor = UNITS[unit];
    if (factor === undefined) throw new Error(`unité inconnue : ${unit}`);
    return raw * factor;
  }

  private attendre(character: string): void {
    this.spaces();
    if (this.text[this.i] !== character) throw new Error(`« ${character} » attendu`);
    this.i += 1;
  }

  private spaces(): void {
    while (this.i < this.text.length && /\s/.test(this.text[this.i])) this.i += 1;
  }
}

function apply(name: string, args: number[]): number {
  if (name === "calc") {
    if (args.length !== 1) throw new Error("calc() prend un seul argument");
    return args[0];
  }
  if (name === "clamp") {
    if (args.length !== 3) throw new Error("clamp() prend trois arguments");
    const [plancher, voulu, plafond] = args;
    return Math.max(plancher, Math.min(voulu, plafond));
  }
  if (args.length === 0) throw new Error(`${name}() sans argument`);
  return name === "min" ? Math.min(...args) : Math.max(...args);
}
