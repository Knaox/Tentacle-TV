/**
 * Le jeton en paramètre (`?api_key=` / `?apikey=`) sur le relais : un
 * `<audio>` ne pose pas d'en-tête, et un client à jeton sans cookie (bureau sans
 * libmpv) n'aurait que lui. Même règle que le proxy Jellyfin
 * (`routes/jellyfinProxy/incomingAuth.ts`) — le jeton EXPLICITE de la requête
 * l'emporte sur un `Bearer`, puis le cookie est départagé par
 * `sessionTokenChoice` (dans `requireAuth`). Trois gardes en plus :
 * - GET seulement : sur toute autre méthode, un jeton en paramètre vaut 401 ;
 * - le paramètre est RETIRÉ de l'URL relayée : l'invité ne le voit jamais ;
 * - jamais journalisé : le sérialiseur du serveur masque `api_key`
 *   (`services/logRedaction.ts`), et ce module n'écrit rien.
 */

const TOKEN_KEYS = new Set(["api_key", "apikey"]);

export interface QueryAuth {
  /** Le jeton trouvé dans la requête (le premier, s'il y en a plusieurs). */
  token: string | null;
  /** Le paramètre est présent, même vide : hors GET, c'est un refus. */
  present: boolean;
  /** La cible relayée à l'invité, sans le paramètre. */
  target: string;
}

export function splitQueryAuth(target: string): QueryAuth {
  const q = target.indexOf("?");
  if (q < 0) return { token: null, present: false, target };
  const path = target.slice(0, q);
  const kept: string[] = [];
  let token: string | null = null;
  let present = false;
  for (const part of target.slice(q + 1).split("&")) {
    if (part === "") continue;
    const eq = part.indexOf("=");
    const rawKey = eq < 0 ? part : part.slice(0, eq);
    let key: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, " ")).toLowerCase();
    } catch {
      key = rawKey.toLowerCase();
    }
    if (!TOKEN_KEYS.has(key)) {
      kept.push(part);
      continue;
    }
    present = true;
    if (token === null && eq >= 0) {
      try {
        token = decodeURIComponent(part.slice(eq + 1).replace(/\+/g, " ")) || null;
      } catch {
        token = null;
      }
    }
  }
  return { token, present, target: kept.length > 0 ? `${path}?${kept.join("&")}` : path };
}
