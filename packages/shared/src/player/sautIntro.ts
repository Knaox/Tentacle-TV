/**
 * Faut-il montrer la pilule « Passer l'intro », et compter avant de sauter ?
 *
 * # Pourquoi un réducteur pur plutôt qu'un hook
 *
 * Trois questions se croisent ici — la préférence est-elle active, où en est la
 * lecture, l'utilisateur s'est-il opposé — et deux défauts d'usage sont nés de
 * ce croisement. Le dépôt a déjà sa réponse pour ce genre de logique :
 * `seekLanding.ts`, un réducteur sans horloge ni React, que son banc peut
 * dérouler seconde par seconde. Rien ici n'a besoin d'un DOM pour être vérifié,
 * et il n'existe de toute façon aucun outil pour rendre un hook dans les tests.
 *
 * # Les deux défauts que cette machine corrige
 *
 * 1. **Le refus ne se laissait pas défaire.** Il était mémorisé pour l'épisode.
 *    Or on peut traverser une intro plusieurs fois : revenir dedans doit
 *    redonner sa chance au saut automatique. Le refus vaut donc pour LE PASSAGE
 *    en cours, pas pour l'épisode — c'est déjà ce que fait le téléviseur
 *    (`TVSkipSegmentButton`, « reset dismissed when segment goes out of range »).
 *
 * 2. **La pilule survivait au saut.** Elle réapparaissait quelques secondes sous
 *    son libellé manuel, parce que la position de lecture met du temps à
 *    rattraper : elle n'est échantillonnée qu'à 1 Hz, et un saut HLS peut
 *    demander plusieurs secondes avant d'aboutir. L'état `saute` masque la
 *    pilule pendant ce trajet — le saut a été demandé, le redire n'apporte rien.
 */

/** Trois secondes : le temps de voir la pilule et de s'y opposer. */
export const DEPART_SAUT_INTRO = 3;

/**
 * Au-delà, on rend le bouton manuel. Un saut peut échouer — réseau coupé,
 * session de transcodage à refaire — et l'utilisateur ne doit pas rester devant
 * une intro sans aucun moyen de la passer.
 */
export const GARDE_SAUT_MS = 10_000;

export type EtatSautIntro =
  | { nom: "repos" }
  | { nom: "decompte"; reste: number }
  | { nom: "refuse" }
  | { nom: "saute"; depuisMs: number };

export type EntreeSautIntro =
  | { type: "cadre"; visible: boolean; actif: boolean; ecouleMs: number }
  | { type: "croix" }
  | { type: "sauteMaintenant" };

/** Ce que l'appelant doit faire, en plus de retenir le nouvel état. */
export type ActionSautIntro = "rien" | "sauter";

export const REPOS: EtatSautIntro = { nom: "repos" };

/**
 * `visible` est la fenêtre d'intro telle que le lecteur la calcule déjà. Son
 * front MONTANT réarme : c'est là, et nulle part ailleurs, que le refus tombe.
 */
export function deciderSautIntro(
  etat: EtatSautIntro,
  entree: EntreeSautIntro,
  visiblePrecedent: boolean,
): [EtatSautIntro, ActionSautIntro] {
  if (entree.type === "croix") return [{ nom: "refuse" }, "rien"];
  if (entree.type === "sauteMaintenant") return [{ nom: "saute", depuisMs: 0 }, "sauter"];

  const { visible, actif, ecouleMs } = entree;

  // Sortie de l'intro : tout retombe, y compris un saut en vol — la position a
  // rattrapé, c'est précisément ce que le saut attendait.
  if (!visible) return [REPOS, "rien"];

  // Entrée dans l'intro. Le refus d'un passage précédent ne la suit pas.
  if (!visiblePrecedent) {
    return actif ? [{ nom: "decompte", reste: DEPART_SAUT_INTRO }, "rien"] : [REPOS, "rien"];
  }

  if (etat.nom === "saute") {
    const depuisMs = etat.depuisMs + ecouleMs;
    // Le saut n'a jamais abouti : on rend le bouton manuel plutôt que de laisser
    // l'utilisateur devant une intro qu'il ne peut plus passer.
    return depuisMs >= GARDE_SAUT_MS ? [REPOS, "rien"] : [{ nom: "saute", depuisMs }, "rien"];
  }

  if (etat.nom === "refuse") return [etat, "rien"];

  // La préférence peut s'éteindre pendant le décompte : il s'arrête, la pilule
  // reste, et elle redevient ce qu'elle était — un bouton.
  if (!actif) return [REPOS, "rien"];

  if (etat.nom === "repos") return [{ nom: "decompte", reste: DEPART_SAUT_INTRO }, "rien"];

  // `ecouleMs` nul = simple réévaluation (la préférence vient de changer, par
  // exemple), pas un battement d'horloge : le décompte ne doit pas y perdre une
  // seconde.
  if (ecouleMs <= 0) return [etat, "rien"];

  const reste = etat.reste - 1;
  return reste <= 0
    ? [{ nom: "saute", depuisMs: 0 }, "sauter"]
    : [{ nom: "decompte", reste }, "rien"];
}

/** La pilule se rend-elle ? Pendant un saut, non : il a déjà été demandé. */
export const montrerPilule = (etat: EtatSautIntro, visible: boolean): boolean =>
  visible && etat.nom !== "saute";

/** Secondes affichées, `null` quand la pilule est un simple bouton. */
export const compteAffiche = (etat: EtatSautIntro): number | null =>
  etat.nom === "decompte" ? etat.reste : null;
