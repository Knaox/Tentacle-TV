/**
 * Le message d'un échec de connexion, trié comme `pages/Login.tsx` : 401 →
 * identifiants invalides, 502/503 → serveur injoignable, sinon le message du
 * serveur ou l'échec générique. Rend une clé i18n, ou le message brut.
 */
export function loginErrorMessage(message: string | undefined): { key: string } | { text: string } {
  if (message?.includes("401")) return { key: "invalidCredentials" };
  if (message?.includes("502") || message?.includes("503")) return { key: "common:offlineTitle" };
  return message ? { text: message } : { key: "loginFailed" };
}
