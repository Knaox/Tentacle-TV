/**
 * Règle pure : comment un écran de saisie évite le clavier, selon la plateforme.
 *
 * Android est en bord à bord (`edgeToEdgeEnabled`, Expo 54 / RN 0.81) : la
 * fenêtre ne rétrécit plus sous le clavier, `adjustResize` du manifeste
 * n'agit plus seul. C'est donc à l'écran de se replier au-dessus du clavier —
 * TOUJOURS, sinon le clavier recouvre le champ actif (bug du 06/10, OPPO
 * Find X3 Pro). Sur iOS, rien ne change : l'écran garde le réglage qu'il
 * avait (`ios: false` pour ceux qui n'évitaient pas le clavier).
 */
export type KeyboardBehavior = "padding" | undefined;

export function keyboardAvoidanceBehavior(os: string, ios: boolean): KeyboardBehavior {
  if (os === "android") return "padding";
  if (os === "ios") return ios ? "padding" : undefined;
  return undefined;
}
