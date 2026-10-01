/**
 * Les erreurs du lecteur natif d'Apple TV (AVPlayer), classées — une décision
 * pure, lue par la surface (`AVPlayerSurface`) qui en fait le marqueur que le
 * gestionnaire d'erreurs commun reconnaît (`useTVErrorHandler`).
 *
 * Une erreur AUDIO PASSAGÈRE n'est pas un refus du flux : la sortie a changé
 * sous la lecture (HDMI, AirPlay, ampli rallumé) ou le serveur audio a
 * redémarré. Prise pour un master refusé, elle faisait descendre la lecture
 * en forme muxée, puis en transcodage serveur — mesuré au simulateur sur un
 * -66681. Elle se rejoue à la MÊME forme ; une descente de qualité ne
 * rendrait pas la sortie audio.
 */

export type AvPlayerErrorKind = "audioTransient" | "masterRejected" | "format" | "other";

/** La sortie audio passagèrement indisponible. */
const TRANSIENT_AUDIO_CODES: ReadonlySet<number> = new Set([
  -66681, // kAudioQueueErr_CannotStart : le périphérique audio reconfiguré
  -66680, // kAudioQueueErr_InvalidDevice : la sortie a changé sous la file audio
  -66671, // kAudioQueueErr_QueueInvalidated : le serveur audio a redémarré
  -66665, // kAudioQueueErr_CannotStartYet : la session audio n'est pas encore prête
  -11819, // AVErrorMediaServicesWereReset : les services média ont redémarré
]);

/** Format ou conteneur illisible (-11828), opération refusée (-11800). */
const FORMAT_CODES: ReadonlySet<number> = new Set([-11828, -11800]);
const FORMAT_TEXT = /format|codec|cannot open|decode/i;

/**
 * Les codes que porte une erreur : le sien, et ceux du texte — AVFoundation
 * enrobe d'ordinaire l'OSStatus d'origine dans un -11800 et ne le dit que
 * dans la raison (« An unknown error occurred (-66681) »).
 */
function codesOf(code: number | undefined, text: string): number[] {
  const found = (text.match(/-\d{4,6}\b/g) ?? []).map(Number);
  return code === undefined ? found : [code, ...found];
}

/**
 * - `audioTransient` : à rejouer à la même forme (`AUDIO_RETRY_DELAYS_MS`) ;
 * - `masterRejected` : le flux de PrismCore (bouclage local) refusé — la
 *   forme muxée, puis le transcodage. Quel que soit le code : la règle
 *   tenait une LISTE (-11868 / -11848 / -1002, typiquement « Adapter la
 *   plage dynamique » coupé sur un panneau HDR), et un 4K Dolby Vision dont
 *   les deux pistes audio passent par le pont EAC3 échouait en -16170, qui
 *   n'y figurait pas — la lecture s'arrêtait sur un message que rien ne
 *   rattrapait. On ne sait pas d'avance ce qu'AVPlayer reproche à un flux
 *   qu'on fabrique soi-même ; la boucle est bornée en aval (une forme muxée
 *   par lecture, puis le transcodage) ;
 * - `format` : hors PrismCore, un codec ou un conteneur illisible (-11828),
 *   une opération refusée (-11800) — le transcodage ;
 * - `other` : le reste, dit tel quel.
 */
export function classifyAvPlayerError(e: { code?: number; text: string; loopback: boolean }): AvPlayerErrorKind {
  const codes = codesOf(e.code, e.text);
  if (codes.some((code) => TRANSIENT_AUDIO_CODES.has(code))) return "audioTransient";
  if (e.loopback) return "masterRejected";
  if ((e.code !== undefined && FORMAT_CODES.has(e.code)) || FORMAT_TEXT.test(e.text)) return "format";
  return "other";
}

/** Le marqueur d'une erreur audio passagère, de la surface au gestionnaire. */
export const AUDIO_TRANSIENT_ERROR = "AUDIO_TRANSIENT";

export function isAudioTransientError(error: string): boolean {
  return error.startsWith(AUDIO_TRANSIENT_ERROR);
}

/**
 * Les nouvelles tentatives d'un même incident audio, à la même forme : leurs
 * délais. Jamais tout de suite : le périphérique reste absent quelques
 * secondes (mesuré : la forme muxée ouverte 1 s après l'erreur a échoué à
 * son tour, 3 s plus tard). Au-delà, l'erreur est DITE — une sortie qui ne
 * revient pas n'est pas l'affaire du flux. L'incident se clôt quand la
 * lecture avance.
 */
export const AUDIO_RETRY_DELAYS_MS: readonly number[] = [1500, 4000, 8000];

/** Le délai de la tentative `attempt` (0 pour la première), ou `null` : budget épuisé. */
export function audioRetryDelay(attempt: number): number | null {
  return attempt >= 0 && attempt < AUDIO_RETRY_DELAYS_MS.length ? AUDIO_RETRY_DELAYS_MS[attempt] : null;
}
