import { getSeerrConfig } from "./seerConfig";
import { tmdbConfigured } from "./tmdb/client";

/**
 * LE catalogue des rangées de l'accueil : la table unique dont dérivent les
 * clés admises au PUT, l'ordre et l'activation par défaut d'un compte sans
 * réglage, et ce que l'éditeur propose. Une rangée n'est proposée que si CE
 * serveur sait la servir : sans clé TMDB, les rangées personnalisées
 * n'existent pas (serveContext → « disabled ») ; « À découvrir » exige en plus
 * Vigie ; les tendances viennent de TMDB ou de Vigie ; le pouls et les mieux
 * notés viennent de Jellyfin seul. Les bibliothèques (`library:<guid>`) sont
 * dynamiques : le client les réconcilie, elles ne figurent pas ici.
 */
export interface HomeRowCapabilities {
  tmdb: boolean;
  vigie: boolean;
}

export interface HomeRowDescriptor {
  key: string;
  enabled: boolean;
}

interface HomeRowSpec {
  key: string;
  servable: (caps: HomeRowCapabilities) => boolean;
  enabledByDefault: (caps: HomeRowCapabilities) => boolean;
}

const ALWAYS = () => true;
const NEVER = () => false;
const WITH_TMDB = (caps: HomeRowCapabilities) => caps.tmdb;
const WITHOUT_TMDB = (caps: HomeRowCapabilities) => !caps.tmdb;

// Ordre = ordre par défaut de l'accueil : reprise, prochains, « Pour vous »,
// déjà visionné, Ma liste, favoris, puis les rangées de recommandation dans
// l'ordre de la page Recommandations. Sans clé TMDB, les deux rangées
// génériques tiennent le rôle de « Pour vous » : l'accueil garde des
// recommandations, et un compte sans réglage bascule seul sur le défaut
// complet le jour où l'admin pose la clé.
const HOME_ROW_SPECS: readonly HomeRowSpec[] = [
  { key: "resume", servable: ALWAYS, enabledByDefault: ALWAYS },
  { key: "nextUp", servable: ALWAYS, enabledByDefault: ALWAYS },
  { key: "reco:forYou", servable: WITH_TMDB, enabledByDefault: ALWAYS },
  { key: "watched", servable: ALWAYS, enabledByDefault: ALWAYS },
  { key: "watchlist", servable: ALWAYS, enabledByDefault: ALWAYS },
  { key: "favorites", servable: ALWAYS, enabledByDefault: NEVER },
  { key: "reco:inLibrary", servable: WITH_TMDB, enabledByDefault: NEVER },
  { key: "reco:anime", servable: WITH_TMDB, enabledByDefault: NEVER },
  { key: "reco:discover", servable: (caps) => caps.tmdb && caps.vigie, enabledByDefault: NEVER },
  { key: "reco:trending", servable: (caps) => caps.tmdb || caps.vigie, enabledByDefault: NEVER },
  { key: "reco:serverPulse", servable: ALWAYS, enabledByDefault: WITHOUT_TMDB },
  { key: "reco:community", servable: WITH_TMDB, enabledByDefault: NEVER },
  { key: "reco:exploration", servable: WITH_TMDB, enabledByDefault: NEVER },
  { key: "reco:bestOfLibrary", servable: ALWAYS, enabledByDefault: WITHOUT_TMDB },
];

/** Toutes les clés statiques connues — le PUT les accepte quel que soit l'état
 *  des capacités : une mise en page enregistrée avec la clé TMDB reste valide
 *  si la clé s'en va, et reprend vie quand elle revient. */
export const HOME_ROW_KEYS: readonly string[] = HOME_ROW_SPECS.map((spec) => spec.key);

const LIBRARY_ROW_KEY_PATTERN = /^library:[A-Za-z0-9-]+$/;

export function isKnownHomeRowKey(key: string): boolean {
  return HOME_ROW_KEYS.includes(key) || LIBRARY_ROW_KEY_PATTERN.test(key);
}

/** Pur : les rangées que ces capacités permettent, dans l'ordre par défaut,
 *  avec leur activation par défaut. */
export function homeRowCatalog(caps: HomeRowCapabilities): HomeRowDescriptor[] {
  return HOME_ROW_SPECS.filter((spec) => spec.servable(caps)).map((spec) => ({
    key: spec.key,
    enabled: spec.enabledByDefault(caps),
  }));
}

/** Les capacités de CE serveur, lues à la requête : la clé TMDB se pose depuis
 *  l'admin sans redémarrage, le plugin Vigie s'active et se coupe de même. */
export function serverHomeRowCapabilities(): HomeRowCapabilities {
  return { tmdb: tmdbConfigured(), vigie: getSeerrConfig() !== null };
}
