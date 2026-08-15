import type { Root } from "postcss";
import type { ContexteCompat } from "./contexte";

/**
 * Retire le flou d'arrière-plan.
 *
 * `backdrop-filter` n'arrive qu'avec Chrome 76 ; sur le socle visé il est
 * inerte. Le retirer ne change donc rien à l'écran — mais laisse la feuille
 * dire ce qu'elle fait vraiment, et le compteur mesure une dette : chaque
 * règle comptée ici est une surface conçue pour être translucide au-dessus
 * d'un flou, qui se retrouve translucide au-dessus d'une image nette. À trois
 * mètres, c'est illisible.
 *
 * La réparation appartient au thème, pas à cette passe : les jetons de surface
 * du téléviseur sont opaques. `resolveGlassLevel` protège déjà les composants
 * qui passent par lui, mais pas les classes `backdrop-blur-*` écrites à la
 * main — dont la plupart ont d'ailleurs déjà été vidées par le preset TV, qui
 * ramène toute l'échelle de flou à zéro.
 */
export function passeVerre(racine: Root, contexte: ContexteCompat): void {
  racine.walkDecls((declaration) => {
    if (declaration.prop !== "backdrop-filter" && declaration.prop !== "-webkit-backdrop-filter") {
      return;
    }
    // `none` n'est pas un flou, c'est son ABSENCE — et retirer une déclaration
    // qui dit « pas de flou » ne change rien, sauf dans le seul cas où elle est
    // écrite exprès : la règle universelle `!important` de `tv.css`, seule
    // chose qui atteigne les vingt-six `backdropFilter` posés en style en ligne
    // dans `apps/web`. Cette passe l'avait mangée, ce qui la rendait inopérante
    // sans que rien ne le signale.
    if (declaration.value.trim().toLowerCase() === "none") return;
    declaration.remove();
    contexte.compter("verre");
  });
}
