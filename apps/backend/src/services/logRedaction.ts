/**
 * Ce que les journaux ne doivent jamais contenir. Les segments HLS réécrits
 * portent le jeton de session dans l'URL (`?api_key=…`), et le sérialiseur
 * journalise chaque URL : sans ce masque, chaque lecture écrivait des jetons
 * valides dans les journaux du serveur.
 */
const SENSITIVE_QUERY = /([?&](?:api_key|apikey|x-emby-token|token|access_token|accesstoken|pw|password|secret)=)[^&#]*/gi;

export function redactUrl(url: string): string {
  return url.replace(SENSITIVE_QUERY, "$1[redacted]");
}

/** Les champs masqués par pino, à la racine et un niveau plus bas, partout où on les journaliserait. */
const SECRET_FIELDS = ["password", "Pw", "apiKey", "api_key", "token", "accessToken", "AccessToken", "authorization", "cookie"];

export const LOG_REDACT_PATHS = [
  ...SECRET_FIELDS,
  ...SECRET_FIELDS.map((field) => `*.${field}`),
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-emby-token"]',
  'req.headers["x-tentacle-setup"]',
];
