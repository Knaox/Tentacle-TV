/**
 * Masquage des secrets avant journalisation.
 *
 * # Pourquoi
 *
 * `CommandRegistry.install` journalise le motif de chaque commande en échec —
 * et c'est une bonne chose : sans lui, « impossible de lancer le
 * téléchargement » ne désignait rien. Mais ce message est fabriqué par la
 * commande, et certaines manipulent des URL qui portent un jeton :
 *
 *  - les URL de flux et de sous-titres passent par `?api_key=<jeton>`, parce
 *    qu'une balise `<img>`, un `<video>` et un manifeste HLS ne savent pas
 *    porter d'en-tête. C'est la norme de l'écosystème Jellyfin, pas une
 *    négligence — mais un jeton dans un journal en est une ;
 *  - les routes `/api/downloads/*` du backend attendent un `Bearer`.
 *
 * Un journal se copie, se colle dans un ticket et s'attache à une capture
 * d'écran. Le masquage est donc posé AU POINT DE JOURNALISATION, pas dans
 * chaque commande : c'est le seul endroit qu'on ne peut pas oublier.
 *
 * # Ce fichier n'importe rien
 *
 * Ni `electron`, ni le reste de la coquille : il se teste seul.
 */

/** Remplace ce qui est masqué. Court, et reconnaissable dans un journal. */
const REDACTED = "***";

/**
 * Motifs de secret, dans l'ordre d'application.
 *
 * Les noms de paramètre sont ceux que Jellyfin accepte réellement (`api_key` et
 * `ApiKey`, la casse variant selon qui fabrique l'URL), plus les nôtres.
 */
const PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  // Jeton en paramètre d'URL : on garde le NOM du paramètre, il situe l'erreur.
  [/([?&](?:api_key|apikey|token|access_token|x-emby-token)=)[^&\s"']+/gi, `$1${REDACTED}`],
  // En-tête recopié dans un message.
  [/((?:authorization|x-emby-token)\s*:\s*)(?:bearer\s+)?[^\s"',;]+/gi, `$1${REDACTED}`],
  // Forme « Bearer <jeton> » isolée.
  [/\b(bearer\s+)[^\s"',;]+/gi, `$1${REDACTED}`],
];

/**
 * Masque les secrets d'un message destiné au journal.
 *
 * Ne cherche PAS à deviner ce qui « ressemble » à un jeton : un masquage par
 * entropie effacerait des identifiants Jellyfin parfaitement anodins et rendrait
 * les journaux illisibles. On ne masque que ce qui est nommément un secret.
 */
export function redactSecrets(message: string): string {
  let output = message;
  for (const [pattern, replacement] of PATTERNS) {
    output = output.replace(pattern, replacement);
  }
  return output;
}
