/**
 * Une clé TMDB répond-elle ? `/configuration` est l'appel le moins cher de
 * l'API. Trois verdicts, parce que l'admin n'y fait pas la même chose :
 * « refusée » (TMDB répond 401 — clé fausse, révoquée, ou jeton v4 collé à la
 * place de la clé v3) et « injoignable » (réseau coupé, délai dépassé, TMDB en
 * panne, limité ou bloqué — la clé n'est pas en cause, il faut réessayer).
 * Les confondre faisait chercher une faute de frappe à qui n'avait pas de
 * réseau.
 *
 * Hors de l'espaceur de tmdb/client.ts : un geste d'admin, jamais une rafale,
 * et la clé candidate n'est pas celle du serveur. Clé en query param — jamais
 * en Bearer (cf. la doctrine de tmdb/client.ts) et jamais loggée.
 */

export type TmdbKeyVerdict = "valid" | "invalid" | "unreachable";

const CHECK_TIMEOUT_MS = 8000;

export async function checkTmdbKey(candidate: string): Promise<TmdbKeyVerdict> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(candidate)}`,
      { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) }
    );
    if (res.ok) return "valid";
    // 401 est la seule réponse qui parle de la clé. Un 403 vient plutôt d'un
    // blocage réseau (pare-feu, pays), un 429 ou un 5xx de TMDB lui-même.
    return res.status === 401 ? "invalid" : "unreachable";
  } catch {
    return "unreachable";
  }
}
