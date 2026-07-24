/**
 * Préchargement du module de la fiche média.
 *
 * Les pages sont découpées en chunks (`lazyPages.ts`). Au premier clic sur une
 * carte, la route `/media/:id` doit donc TÉLÉCHARGER son module avant de
 * monter — mesuré à plus d'une seconde sur ce poste. Pendant tout ce temps
 * l'écran ne bougeait pas, puis l'animation d'ouverture démarrait d'un coup :
 * c'est exactement ce qui donnait l'impression d'une transition brutale, alors
 * que l'animation elle-même est lente et amortie.
 *
 * On déclenche donc l'import au SURVOL, bien avant le clic. Au moment où
 * l'utilisateur se décide, le module est déjà là et le vol de l'image part
 * immédiatement.
 *
 * `import()` est idempotent : les appels suivants réutilisent la promesse du
 * module déjà résolu. Le drapeau évite juste d'empiler des appels inutiles à
 * chaque survol de carte.
 */
let started = false;

export function prefetchDetailRoute(): void {
  if (started) return;
  started = true;
  // Échec silencieux : un préchargement raté ne doit jamais casser la
  // navigation, qui refera l'import de toute façon.
  import("../../pages/MediaDetail").catch(() => { started = false; });
}
