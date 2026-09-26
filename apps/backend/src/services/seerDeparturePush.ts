// Départ d'une demande Seer (« « Titre » est en route ») : le plugin Vigie
// l'écrit dès que Sonarr ou Radarr prend le titre dans sa file (1.17.0+).
// Poussé sous la même préférence que les arrivées (`seerAvailable`) : qui veut
// savoir quand sa demande arrive veut savoir qu'elle est partie — et aucun
// client n'a à afficher de nouveau réglage. Pas de garde de vérité ni de
// registre : ce n'est pas une annonce de disponibilité, et le plugin ne
// l'écrit qu'une fois par départ.

const DEPARTURE = /^« (.+) » est en route$/;

/** Le titre d'une notification de départ, ou null si ce n'en est pas une. */
export function parseSeerDeparture(n: { body: string | null }): string | null {
  const match = DEPARTURE.exec((n.body ?? "").trim());
  return match ? match[1] : null;
}

/** Le texte du push dans la langue de l'utilisateur (le plugin écrit en français). */
export function departurePushBody(title: string, lang: string): string {
  return lang === "en" ? `“${title}” is on its way` : `« ${title} » est en route`;
}
