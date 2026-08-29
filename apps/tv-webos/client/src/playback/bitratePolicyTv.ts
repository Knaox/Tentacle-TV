import { amorcerMesureDebit, debitEnCache, type JellyfinClient } from "@tentacle-tv/api-client";
import { capForBitrate, type MediaSource, type QualityPreset } from "@tentacle-tv/shared";

/**
 * Politique de débit — version téléviseur : ACTIVE.
 *
 * Substituée à `lib/politiqueDebit.ts` du web au build. Le téléviseur mesure
 * son débit réel (téléchargement témoin BitrateTest, cache 10 min) et, quand
 * la connexion ne porte pas le fichier, impose un palier de l'échelle — mais
 * SEULEMENT si la qualité est restée sur « Originale » : un choix manuel de
 * l'utilisateur prime toujours (arbitrage produit, cf. useQualiteEffective).
 *
 * Le cap est une photographie prise au moment où la source est connue : si la
 * mesure n'a pas encore abouti (premier lancement, lien lent), la lecture part
 * sans cap et les suivantes en profiteront — jamais de renégociation en cours
 * de lecture, jamais de blocage du démarrage.
 */
export function amorcerMesure(client: JellyfinClient): void {
  amorcerMesureDebit(client);
}

export function capAutomatique(source: MediaSource | null | undefined): QualityPreset | null {
  return capForBitrate(source, debitEnCache());
}
