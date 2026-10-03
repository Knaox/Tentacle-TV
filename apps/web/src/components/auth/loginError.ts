import { problemFromError, rawFromError } from "@tentacle-tv/shared";

/**
 * Le message d'un échec de connexion, partagé par `pages/Login.tsx` et
 * `MirrorLogin` — comme le mobile : identifiants refusés, trop d'essais, ou
 * la CAUSE en mots de spectateur (serveur muet, Jellyfin injoignable…) et
 * quoi faire, dans le modèle commun. Plus jamais un « Failed to fetch » ou un
 * « Media server API error 500 » brut, ni un message du serveur en français
 * sur une interface anglaise.
 *
 * Rend des clés i18n : une seule (`key`, la page la reconnaît pour
 * resélectionner le mot de passe), ou la cause et son aide (`keys`). Une
 * phrase du serveur qui n'a rien de technique (« Compte désactivé ») est
 * gardée telle quelle (`text`) : elle en dit plus que toute traduction.
 */
export type LoginErrorMessage = { key: string } | { keys: string[] } | { text: string };

const TECHNICAL = /fetch|network|api error|http|\b\d{3}\b|time ?out|abort|load failed|json|unexpected token/i;
const BAD_CREDENTIALS = /\b40[01]\b|identifiants invalides|invalid credentials/i;

export function loginErrorMessage(error: unknown): LoginErrorMessage {
  const raw = rawFromError(error, "relayed");
  if (raw.status === 401 || raw.status === 400 || BAD_CREDENTIALS.test(raw.message ?? "")) return { key: "invalidCredentials" };
  if (raw.status === 429 || /\b429\b|too many/i.test(raw.message ?? "")) return { key: "errors:loginRateLimited" };
  if (!raw.status && !raw.message) return { key: "loginFailed" };
  if (!raw.status && raw.message && !TECHNICAL.test(raw.message)) return { text: raw.message };
  const model = problemFromError(error, { target: "relayed", context: "signIn" });
  return { keys: model.hintKey ? [model.reasonKey, model.hintKey] : [model.reasonKey] };
}

/** Le message, traduit. */
export function loginErrorText(message: LoginErrorMessage, t: (key: string) => string): string {
  if ("key" in message) return t(message.key);
  return "text" in message ? message.text : message.keys.map((key) => t(key)).join(" ");
}
