import type { WhatsNewClientTrait } from "./types";

/**
 * Les traits de CET appareil que l'écran des nouveautés consulte (`forClient`).
 *
 * `liquidGlass` : le système permet le verre natif de macOS 26 — que le
 * réglage soit allumé ou non (la 1.40.0 arrive allumée ; l'éteindre ensuite ne
 * rend pas la nouveauté fausse). Jamais déduit de « macOS » seul : un Mac
 * d'avant macOS 26 n'a pas le verre, l'écran ne lui en parle pas.
 *
 * TODO(lg-livraison) : rebrancher sur la détection du socle (lg-natif /
 * lg-tokens) dès qu'elle est fusionnée. D'ici là : aucun trait — prudent, la
 * nouveauté du verre ne se montre nulle part plutôt que là où elle serait fausse.
 */
export function readClientTraits(): ReadonlySet<WhatsNewClientTrait> {
  const traits = new Set<WhatsNewClientTrait>();
  return traits;
}
