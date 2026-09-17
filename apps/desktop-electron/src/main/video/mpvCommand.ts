/**
 * La file de commandes de mpv : envoyer sans bloquer, régler à la réponse.
 * Extrait de `mpv.ts` (limite de 300 lignes) ; la poignée est passée, jamais
 * tenue ici.
 */

import { mpvApi, mpvError } from "./mpvFfi";

/**
 * Commandes en vol : identifiant de réponse → résolution de la promesse.
 *
 * Base haute et volontairement distincte des identifiants de propriétés
 * observées (`index + 1`, donc quelques unités) : les deux familles partagent
 * le champ `reply_userdata` des évènements, et les confondre à la lecture d'un
 * journal coûterait cher.
 */
const COMMAND_ID_BASE = 1_000_000;
const inFlight = new Map<number, (err: string | null) => void>();
let nextCommand = COMMAND_ID_BASE;

/**
 * Exécute une commande mpv SANS bloquer le processus principal.
 *
 * ⚠️ C'est la raison d'être de cette fonction. `mpv_command` ne rend la main
 * qu'une fois la commande terminée, et l'appel FFI est synchrone sur le thread
 * du processus principal : un `sub-add` vers une URL injoignable y restait le
 * temps du `network-timeout` — trente secondes, multipliées par les
 * reconnexions. Pendant tout ce temps l'application entière était gelée, plus
 * un clic ne passait, et la lecture continuait imperturbablement puisque mpv
 * vit sur ses propres threads. Symptôme constaté, journal à l'appui.
 *
 * `mpv_command_async` part et rend la main ; le résultat arrive en
 * `COMMAND_REPLY`, que la boucle d'évènements récupère déjà.
 *
 * Les arguments passent en tableau, jamais concaténés : un chemin de fichier
 * contient des espaces et des guillemets.
 */
export function sendCommand(ctx: unknown, args: readonly string[]): Promise<string | null> {
  if (!ctx) return Promise.resolve("mpv n'est pas demarre");

  const id = nextCommand;
  nextCommand += 1;
  return new Promise<string | null>((resolve) => {
    inFlight.set(id, resolve);
    const sent = mpvError(mpvApi().commandAsync(ctx, id, [...args, null]) as number);
    // Refus à l'ENVOI (arguments invalides, file pleine) : aucune réponse ne
    // viendra jamais, la promesse ne doit pas rester en suspens.
    if (sent !== null) {
      inFlight.delete(id);
      resolve(sent);
    }
  });
}

/** Règle une commande en vol. Un identifiant inconnu est ignoré sans bruit. */
export function settleCommand(id: number, code: number): void {
  const resolve = inFlight.get(id);
  if (resolve === undefined) return;
  inFlight.delete(id);
  resolve(mpvError(code));
}


/**
 * Règle toutes les commandes en vol — entre deux instances. La file
 * d'évènements vient de mourir, ou ne rendra plus rien : une commande laissée
 * en suspens retiendrait pour toujours l'appelant, et donc la poignée IPC qui
 * l'attend — une commande native perdue à chaque changement d'épisode.
 */
export function settleAllCommands(reason: string): void {
  for (const resolve of inFlight.values()) resolve(reason);
  inFlight.clear();
}
