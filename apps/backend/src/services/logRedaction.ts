/**
 * Ce que les journaux ne doivent jamais contenir. Les segments HLS réécrits
 * portent le jeton de session dans l'URL (`?api_key=…`), et le sérialiseur
 * journalise chaque URL : sans ce masque, chaque lecture écrivait des jetons
 * valides dans les journaux du serveur. Même chose pour le relais des
 * bandes-annonces (`?t=…`, `relayToken.ts`) : chaque liste et chaque segment
 * d'un aperçu au survol portent son jeton ; et pour le code d'invitation
 * (`/register?invite=…`) : un code pas encore utilisé qui traîne dans un
 * journal ouvre un compte. `pin` et `code` aussi, par précaution : aucune de nos
 * routes n'en reçoit en paramètre aujourd'hui. Ce qui sert au diagnostic
 * (`key=tv:1399`, `sessionId`, `ticketId`, `userId`…) reste lisible.
 */
const SENSITIVE_QUERY = /([?&](?:api_key|apikey|x-emby-token|token|access_token|accesstoken|pw|password|secret|t|invite|pin|code)=)[^&#]*/gi;

/**
 * Les secrets portés dans le CHEMIN, sous leur forme exacte (les routes fixes
 * voisines ne bougent pas) : le code d'un jumelage de TV (`/api/pair/status/:code`,
 * `/api/pair/device/status/:code` — cinq minutes durant, qui le lit avant la TV
 * prend son jeton) et le jeton d'un lien de partage (`/api/share/:token`, la
 * page `/share/:token` : 16 caractères hexadécimaux).
 */
const SENSITIVE_PATHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^(\/api\/pair\/(?:device\/)?status\/)[^/?#]+/i, "$1[redacted]"],
  [/^(\/(?:api\/)?share\/)[0-9a-f]{16}(?=[/?#]|$)/i, "$1[redacted]"],
];

export function redactUrl(url: string): string {
  let redacted = url.replace(SENSITIVE_QUERY, "$1[redacted]");
  for (const [pattern, replacement] of SENSITIVE_PATHS) redacted = redacted.replace(pattern, replacement);
  return redacted;
}

/**
 * Les champs masqués par pino, à la racine et un niveau plus bas, partout où on
 * les journaliserait — le code d'invitation et les PIN de la Famille compris.
 * Jamais `code` : c'est aussi le nom des codes d'ERREUR, utiles au diagnostic.
 */
const SECRET_FIELDS = [
  "password", "Pw", "apiKey", "api_key", "token", "accessToken", "AccessToken", "authorization", "cookie",
  "inviteKey", "pin", "currentPin",
];

export const LOG_REDACT_PATHS = [
  ...SECRET_FIELDS,
  ...SECRET_FIELDS.map((field) => `*.${field}`),
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-emby-token"]',
  'req.headers["x-tentacle-setup"]',
];
