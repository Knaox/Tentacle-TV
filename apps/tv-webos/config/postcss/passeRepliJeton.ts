import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Le repli déclaré d'un jeton calculé.
 *
 * Une valeur écrite dans un ATTRIBUT — `stop-color` d'un dégradé SVG, un style
 * en ligne — ne peut pas porter de repli : il n'y a qu'une déclaration, et un
 * moteur qui ne la comprend pas n'a rien d'autre à quoi retomber. C'est
 * l'angle mort qui a coûté le `clamp()` des cartes, puis le `color-mix()` du
 * logo, dont les arrêts de dégradé retombaient au noir sur la dalle.
 *
 * Le remède est de ramener ces valeurs dans un JETON, où la cascade rend le
 * repli possible — la valeur littérale d'abord, la version calculée ensuite :
 *
 *     --brand-mid: #A855F7;
 *     --brand-mid: color-mix(in srgb, var(--brand) 50%, var(--brand-accent) 50%);
 *
 * Un navigateur récent garde la seconde ; Chrome 53 la jette à l'analyse et
 * garde la première. Cette passe fait le tri À LA CONSTRUCTION plutôt que de
 * s'en remettre à l'analyseur du téléviseur : la déclaration trop récente ne
 * part même pas dans le fragment servi.
 *
 * **Elle ne retire que ce qui a un repli.** Une primitive trop récente déclarée
 * SEULE reste en place, et `gardeCompat` fait alors échouer le build — ce qui
 * est exactement ce qu'on veut : la passe entérine une convention, elle ne
 * couvre pas un oubli.
 */

/** Les fonctions dont la seule issue raisonnable est un repli déclaré. */
const CALCULEES = /\b(color-mix|light-dark|oklch|oklab|lab|lch)\(/i;

export function passeRepliJeton(racine: Root, contexte: ContexteCompat): void {
  racine.walkRules((regle) => {
    // Le repli doit précéder : on ne retire une déclaration que si la MÊME
    // propriété a déjà été déclarée plus haut dans la même règle. C'est la
    // preuve qu'il reste quelque chose après le retrait.
    const declarees = new Set<string>();

    regle.each((noeud) => {
      if (noeud.type !== "decl") return;
      if (!CALCULEES.test(noeud.value)) {
        declarees.add(noeud.prop);
        return;
      }
      if (!declarees.has(noeud.prop)) return;
      noeud.remove();
      contexte.compter("replis-de-jeton");
    });
  });
}
