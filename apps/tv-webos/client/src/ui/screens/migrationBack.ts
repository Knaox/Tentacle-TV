import type { BackConsumer } from "../../focus/back";

/**
 * Retour pendant l'écran d'attente de la migration de la base : rien à
 * refermer, rien d'en dessous à toucher — la main revient au téléviseur
 * (son menu), comme Menu sur l'Apple TV et Retour sur Android TV. Sans ce
 * preneur, le renvoi d'Échap au dialogue (`closeTrappingContainer`) avalait
 * l'appui en silence.
 */
export function holdBackDuringMigration(register: (consumer: BackConsumer) => () => void, yieldToTv: () => void): () => void {
  return register(() => {
    yieldToTv();
    return true;
  });
}
