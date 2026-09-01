import { primeBitrateMeasure, cachedBitrate, type JellyfinClient } from "@tentacle-tv/api-client";
import { capForBitrate, type MediaSource, type QualityPreset } from "@tentacle-tv/shared";

/**
 * Politique de débit — version navigateur/desktop : ACTIVE.
 *
 * Longtemps inerte ici (« un ordinateur a un écran à portée de main, on ne
 * réduit jamais sa qualité dans son dos ») — décision produit ANNULÉE : la
 * qualité « Auto » vaut désormais pour toutes les plateformes. La protection
 * demeure, ailleurs : un choix MANUEL du menu désarme le cap pour l'item
 * (useEffectiveQuality), et rien n'est jamais rétrogradé par-dessus.
 *
 * Mécanique du téléviseur, à la lettre : mesure du débit réel (téléchargement
 * témoin BitrateTest, cache 10 min) et cap sur l'échelle quand la connexion ne
 * porte pas le fichier — photographie au moment où la source est connue,
 * jamais de renégociation en cours de lecture, jamais de blocage du démarrage
 * (mesure absente → lecture sans cap, les suivantes en profiteront). La
 * substitution webOS (`substitutionTable.ts` → `bitratePolicyTv.ts`) devient
 * un doublon inoffensif — elle reste, le téléviseur a son propre module.
 */
export function startBitrateMeasurement(client: JellyfinClient): void {
  primeBitrateMeasure(client);
}

export function automaticCap(source: MediaSource | null | undefined): QualityPreset | null {
  return capForBitrate(source, cachedBitrate());
}
