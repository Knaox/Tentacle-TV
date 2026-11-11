/**
 * La FIN d'une animation que framer-motion confie au compositeur, sans l'image fautive.
 *
 * # Le défaut (mesuré, nov. 2026)
 *
 * Pour `opacity` et `transform`, framer-motion lance une animation WAAPI (`element.animate`,
 * `fill: "both"`) et, à son évènement `finish`, fait deux choses : il met sa valeur à la valeur
 * finale — ce qui n'écrit le style en ligne qu'à la PROCHAINE passe de `requestAnimationFrame` —
 * puis annule l'animation tout de suite. Entre les deux, l'élément n'a plus que son style en ligne
 * d'AVANT l'animation.
 *
 * Tant qu'une boucle d'images tourne dans la page, l'évènement arrive avant la passe de rAF de la
 * même image : rien ne se voit. Mais dans une page AU CALME — une feuille qui s'ouvre sur une page
 * immobile —, Chromium livre `finish` après cette passe : l'annulation est peinte, l'écriture
 * n'arrive qu'à l'image suivante. Pendant UNE image, l'élément retombe à sa valeur de départ :
 *
 *  - à l'ouverture d'une feuille, le voile disparaît (la page revient nette et claire), puis la
 *    feuille seule disparaît ;
 *  - à la fermeture, la feuille et son voile reparaissent pleins, après s'être effacés.
 *
 * C'est le « scintillement » relevé à l'ouverture et à la fermeture de « garder hors ligne », et
 * de tout ce qui s'anime par framer-motion sur une page immobile (menus, feuilles, fondus).
 * Banc : page de test dans la coquille, pixels de chaque image lus par `shell.debug.webPixel` —
 * 12 retombées sur 12 fins d'animation en page calme, 0 sur 12 avec cette garde.
 *
 * # La garde
 *
 * Un écouteur `finish` posé à la CRÉATION de l'animation — donc avant celui de framer-motion, qui
 * n'installe le sien qu'ensuite — fige la valeur finale dans le style en ligne
 * (`commitStyles()`, synchrone). Quand framer-motion annule l'animation, le style dessous est déjà
 * le bon ; sa propre écriture, une image plus tard, repose la même valeur.
 *
 * Seules les animations à la FORME de framer-motion sont gardées (une propriété en objet,
 * `fill: "both"`) : les nôtres (`SlidingMarker`, arrivées et entrées de rangées) passent un
 * tableau d'images clés et ne s'annulent pas à la fin — leur poser un style en ligne les
 * figerait face aux règles CSS qui les suivent.
 */

/** Ce que framer-motion passe à `element.animate` : UNE propriété en objet, `fill: "both"`. */
export function isHandedOffAnimation(keyframes: unknown, options: unknown): boolean {
  if (keyframes === null || typeof keyframes !== "object" || Array.isArray(keyframes)) return false;
  if (options === null || typeof options !== "object") return false;
  return (options as KeyframeAnimationOptions).fill === "both";
}

/** Fige la valeur finale dans le style en ligne dès que l'animation finit. */
export function guardFinish(animation: Pick<Animation, "addEventListener" | "commitStyles">): void {
  animation.addEventListener("finish", () => {
    try {
      animation.commitStyles();
    } catch {
      // Cible non rendue (`display: none`, déjà démontée), pseudo-élément, moteur d'avant
      // `commitStyles` (Chromium < 84, téléviseurs) : rien à figer, framer-motion fait comme avant.
    }
  });
}

type AnimateHost = { animate?: Element["animate"] };

let installed = false;

/** À appeler UNE fois, avant le premier rendu (injectable pour les tests). */
export function installWaapiFinishGuard(host: AnimateHost | undefined = typeof Element === "undefined" ? undefined : Element.prototype): void {
  if (installed || !host || typeof host.animate !== "function") return;
  installed = true;
  const animate = host.animate;
  host.animate = function guardedAnimate(this: Element, keyframes, options) {
    const animation = animate.call(this, keyframes, options);
    if (isHandedOffAnimation(keyframes, options)) guardFinish(animation);
    return animation;
  };
}

/** Pour les tests : la garde peut être reposée sur un autre hôte. */
export function resetWaapiFinishGuardForTests(): void {
  installed = false;
}
