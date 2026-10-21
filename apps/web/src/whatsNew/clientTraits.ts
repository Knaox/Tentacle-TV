import { readNativeGlassBridge } from "../theme/liquidGlassMode";
import type { WhatsNewClientTrait } from "./types";

/**
 * Les traits de CET appareil que l'écran des nouveautés consulte (`forClient`).
 *
 * `liquidGlass` : le pont de la coquille annonce le verre natif de macOS 26
 * (`readNativeGlassBridge`, la même lecture que le mode du verre) — que le
 * réglage soit allumé ou non : la 1.40.0 arrive allumée, et l'éteindre ensuite
 * ne rend pas la nouveauté fausse. Jamais déduit de « macOS » seul : un Mac
 * d'avant macOS 26 n'a pas le verre, l'écran ne lui en parle pas.
 */
export function readClientTraits(): ReadonlySet<WhatsNewClientTrait> {
  const traits = new Set<WhatsNewClientTrait>();
  if (readNativeGlassBridge() !== null) traits.add("liquidGlass");
  return traits;
}
