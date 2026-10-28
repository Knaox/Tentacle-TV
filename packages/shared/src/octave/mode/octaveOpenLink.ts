/**
 * Octave — OUVRIR un lien dans l'app. Trois formes d'un même lien, une seule règle :
 * - `tentacle://octave/<page>` : le schéma de l'app (mobile, et le bureau, qui le déclare au système) ;
 * - `<serveur>/octave/open/<page>` : la page d'ouverture du serveur (capacité `music.sharedLinks`), celle qu'on
 *   ENVOIE à quelqu'un — sans script, elle propose « Ouvrir dans l'app Tentacle » et le navigateur ;
 * - `/octave/<page>` : la route elle-même (web, bureau, expo-router reprennent les mêmes chemins).
 * Seules quelques pages s'ouvrent ainsi (liste FERMÉE, `OPENABLE`) : un lien venu d'ailleurs ne mène jamais
 * à une route arbitraire (réglages, compte, import…).
 *
 * Liens universels iOS et App Links Android : impossibles ici — chaque serveur a SON domaine, et ces liens
 * exigent un domaine fixé dans l'app à la compilation. La page d'ouverture en tient lieu.
 */

import { OCTAVE_BASE_PATH } from "./octavePaths";

/** Le schéma de l'app et l'hôte d'Octave dans ce schéma (traversent le système : jamais renommés). */
export const TENTACLE_APP_SCHEME = "tentacle";
export const OCTAVE_APP_LINK_HOST = "octave";
/** La page d'ouverture du serveur (`/octave/open/<page>`), servie même interface web coupée. */
export const OCTAVE_OPEN_PATH = `${OCTAVE_BASE_PATH}/open`;

const KEY = "[^/?#]{1,200}";
/** Les pages qu'un lien peut ouvrir — et rien d'autre. */
const OPENABLE = [new RegExp(`^/(playlist|album|artist|mix)/${KEY}$`), /^\/search$/];

/** La page Octave admise d'un chemin (`/octave/…`), requête comprise pour la recherche ; sinon `null`. */
function admitted(rest: string, search: URLSearchParams): string | null {
  const page = rest.replace(/\/+$/, "");
  if (!OPENABLE.some((pattern) => pattern.test(page))) return null;
  if (page === "/search") {
    const q = (search.get("q") ?? "").trim().slice(0, 4096);
    return q ? `${OCTAVE_BASE_PATH}/search?q=${encodeURIComponent(q)}` : null;
  }
  return `${OCTAVE_BASE_PATH}${page}`;
}

/**
 * Le chemin Octave (`/octave/playlist/<id>`…) qu'ouvre un lien, sous l'une de ses trois formes ; `null` pour tout
 * autre lien ou une page non admise. L'origine d'une page d'ouverture n'est pas vérifiée : l'app ouvre toujours
 * la page sur SON serveur, qui dit ce que le compte voit.
 */
export function octaveOpenTarget(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw || raw.length > 8192) return null;
  let url: URL;
  try {
    url = new URL(raw, "http://local.invalid");
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol === `${TENTACLE_APP_SCHEME}:`) {
    // `tentacle://octave/playlist/x` : l'hôte est `octave`, le chemin la page.
    return url.hostname === OCTAVE_APP_LINK_HOST ? admitted(url.pathname, url.searchParams) : null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const path = url.pathname;
  // Un préfixe de chemin du serveur est permis (`/tentacle/octave/open/…`), comme pour les liens de partage.
  const open = path.indexOf(`${OCTAVE_OPEN_PATH}/`);
  if (open >= 0) return admitted(path.slice(open + OCTAVE_OPEN_PATH.length), url.searchParams);
  // Une route nue seulement si elle est relative (un chemin d'app, jamais l'adresse d'un tiers).
  if (raw.startsWith(`${OCTAVE_BASE_PATH}/`)) return admitted(path.slice(OCTAVE_BASE_PATH.length), url.searchParams);
  return null;
}

/** Le lien à ENVOYER pour une page d'Octave : `<origine>/octave/open/<page>` ; `null` si la page n'est pas admise. */
export function octaveOpenUrl(origin: string, octavePath: string): string | null {
  const target = octaveOpenTarget(octavePath);
  if (!target) return null;
  return `${origin.replace(/\/+$/, "")}${OCTAVE_OPEN_PATH}${target.slice(OCTAVE_BASE_PATH.length)}`;
}

/** Le lien du schéma de l'app pour une page admise : `tentacle://octave/<page>` ; sinon `null`. */
export function octaveAppLink(octavePath: string): string | null {
  const target = octaveOpenTarget(octavePath);
  return target ? `${TENTACLE_APP_SCHEME}://${OCTAVE_APP_LINK_HOST}${target.slice(OCTAVE_BASE_PATH.length)}` : null;
}
