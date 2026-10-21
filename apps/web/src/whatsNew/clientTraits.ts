import { readNativeGlassBridge } from "../theme/liquidGlassMode";
import type { WhatsNewClientTrait } from "./types";

/**
 * Les traits de CET appareil que l'écran des nouveautés consulte (`forClient`).
 *
 * `liquidGlass` : le pont de la coquille annonce le verre natif de macOS 26
 * (`readNativeGlassBridge`, la même lecture que le mode du verre) — que le
 * réglage soit allumé ou non : la 1.40.0 arrive allumée, et l'éteindre ensuite
 * ne rend pas la nouveauté fausse. Jamais déduit de « macOS » seul : un Mac
 * d'avant macOS 26 n'a pas le verre, l'écran ne lui en parle pas ; un Mac
 * Intel sur macOS 26 a le verre, mais pas le lecteur en verre.
 */
export function readClientTraits(): ReadonlySet<WhatsNewClientTrait> {
  const traits = new Set<WhatsNewClientTrait>();
  const bridge = readNativeGlassBridge();
  if (bridge !== null) traits.add("liquidGlass");
  // Le lecteur ne prend le verre que si le verre natif voit la vidéo (montage
  // `fenetre`, Apple Silicon) — même porte que `playerGlassMode.ts`.
  if (bridge?.refractsVideo === true) traits.add("liquidGlassPlayer");
  return traits;
}
