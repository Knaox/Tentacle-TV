/**
 * Le RETOUR propre à un écran, quand ce n'est ni un menu ni le rail (la pile
 * des couches de `backLayers`, T4). Module pur : l'écran inscrit sa couche,
 * la plateforme l'applique.
 */

/** Les étapes de l'automate du jumelage. */
export type PairingFlowStep = "welcome" | "relayCode" | "manualServer" | "manualLogin" | "manualCode" | "success";

export type PairingBackAction = "toWelcome" | "toServer" | "toLogin";

/**
 * Retour sur une étape du jumelage (JU-7) — une couche « page », comme sa
 * croix : le code du relais et le serveur saisi reviennent à l'accueil, les
 * identifiants au serveur, le code du serveur aux identifiants. L'accueil et le
 * succès n'en ont pas : Menu y revient à la plateforme, qui QUITTE
 * l'application (le jumelage n'est jamais une page poussée).
 */
export function pairingBackAction(step: PairingFlowStep): PairingBackAction | null {
  switch (step) {
    case "relayCode":
    case "manualServer":
      return "toWelcome";
    case "manualLogin":
      return "toServer";
    case "manualCode":
      return "toLogin";
    default:
      return null;
  }
}
