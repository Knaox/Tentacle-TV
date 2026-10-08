/**
 * Les CAPACITÉS du serveur — le serveur décide de ce que les clients montrent.
 *
 * Un client ne montre JAMAIS une option, une section ou une fonction que son
 * serveur ne sait pas faire : un appareil à jour face à un serveur plus ancien
 * n'en voit rien et n'en subit aucun effet. Le serveur déclare ce qu'il sait
 * faire dans `GET /api/config` → `capabilities` ; les clients ne lisent que
 * cette déclaration, par une seule porte (`useServerCapability`,
 * `ServerCapabilityGate` dans api-client) — jamais un `if (version >= x)`.
 *
 * Une fonction purement CLIENT (fréquence d'écran, réglages du lecteur…)
 * n'a pas de clé : rien ne dépend du serveur.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/serverCapabilities/serverCapabilities.ts` (le backend ne
 * dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/serverCapabilities/serverCapabilities.ts apps/backend/src/serverCapabilities/
 *
 * `capabilitiesMirror.test.ts` (backend) refuse toute divergence. Aucun
 * import : le fichier doit compiler seul des deux côtés.
 */

/**
 * Liste FERMÉE : clé → version du serveur qui l'a apportée (`since`).
 *
 * ⚠️ Les clés traversent le réseau (JSON de `/api/config`) : une clé ne se
 * RENOMME jamais et ne se retire pas tant qu'un client livré la lit. Une
 * nouvelle fonction qui dépend du serveur ajoute SA clé ici, avec la version
 * du serveur qui la livrera.
 *
 * `since` ne sert qu'aux serveurs d'AVANT la déclaration (≤ 1.23.x), qui ne
 * rendent pas `capabilities` : une clé y vaut présente si leur version atteint
 * `since`. Toutes les clés d'aujourd'hui datent de 1.24.0 : un serveur d'avant
 * n'en a donc aucune, et les clients restent dans le comportement d'avant.
 * Dès qu'un serveur déclare, SA liste fait foi, quelle que soit sa version.
 */
export const SERVER_CAPABILITIES = {
  /** L'état de Jellyfin suivi et dit aux lecteurs : `server:jellyfin` sur le canal
   *  de session, `/api/health` › `jellyfin`, et la reprise des lectures à son retour. */
  "jellyfin.health": "1.24.0",
  /** « Installer / réparer la détection des passages » (`/api/admin/jellyfin/segment-plugins`)
   *  et sa recommandation du tableau de bord. */
  "admin.segmentPlugins": "1.24.0",
  /** La section d'administration « Accès à distance » (`/api/admin/remote-access`). */
  "admin.remoteAccess": "1.24.0",
  /** « Accès depuis l'extérieur » qui gouverne ce qui est publié, l'adresse publique
   *  détectée (`/api/admin/remote-access/public-ip`) et la lecture directe sans
   *  adresse publique de Jellyfin (l'adresse privée suffit). */
  "admin.remoteExposure": "1.24.0",
  /** Les titres demandés masqués des recommandations (`GET /api/reco/requested`). */
  "reco.requestedTitles": "1.24.0",
  /** L'état des sessions du tableau de bord décrit par le serveur : « direct »,
   *  « En analyse », limite de débit de l'appareil (`transcodeMemory`). */
  "admin.sessionStates": "1.24.0",
  /** Le passage de MariaDB à SQLite dit aux clients : `/api/health` › `database`
   *  (`migrating`, `failed`) et les 503 `{ state: "migrating" }` du mode maintenance —
   *  l'écran d'attente, jamais une panne. */
  "server.databaseMigration": "1.25.0",
} as const satisfies Record<string, string>;

export type ServerCapability = keyof typeof SERVER_CAPABILITIES;

export const SERVER_CAPABILITY_KEYS = Object.keys(SERVER_CAPABILITIES) as ServerCapability[];

export function isServerCapability(value: unknown): value is ServerCapability {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SERVER_CAPABILITIES, value);
}

/** Ce que `GET /api/config` apporte à la décision (le reste est ignoré). */
export interface ServerCapabilitiesSource {
  version?: unknown;
  /** Les clés déclarées. ABSENT : serveur d'avant la déclaration (≤ 1.23.x). */
  capabilities?: unknown;
}

/** « 1.22.3 » → [1, 22, 3] ; un segment illisible vaut 0. */
function versionParts(version: string): number[] {
  return version.trim().replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

function reaches(version: string, since: string): boolean {
  const x = versionParts(version);
  const y = versionParts(since);
  for (let i = 0; i < 3; i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0);
    if (delta !== 0) return delta > 0;
  }
  return true;
}

/**
 * Les capacités d'un serveur, décidées UNE fois :
 * - il déclare `capabilities` → sa liste, réduite aux clés que CE client connaît ;
 * - il ne déclare rien (serveur d'avant) → les clés dont `since` est atteint
 *   par sa version (aujourd'hui : aucune) ;
 * - pas de réponse, réponse illisible → aucune. Rien n'est deviné : une
 *   fonction absente vaut le comportement d'avant, jamais une erreur.
 */
export function resolveServerCapabilities(source: ServerCapabilitiesSource | null | undefined): ReadonlySet<ServerCapability> {
  if (!source || typeof source !== "object") return new Set();
  if (Array.isArray(source.capabilities)) return new Set(source.capabilities.filter(isServerCapability));
  if (typeof source.version !== "string" || !source.version) return new Set();
  const version = source.version;
  return new Set(SERVER_CAPABILITY_KEYS.filter((key) => reaches(version, SERVER_CAPABILITIES[key])));
}

/** Les clés que CE client connaît et que son serveur ne déclare pas. */
export function missingServerCapabilities(capabilities: ReadonlySet<ServerCapability>): ServerCapability[] {
  return SERVER_CAPABILITY_KEYS.filter((key) => !capabilities.has(key));
}

/**
 * La version de serveur la plus récente qu'exige une capacité manquante —
 * « mettez à jour vers au moins X » ; `null` si rien ne manque.
 */
export function newestMissingSince(capabilities: ReadonlySet<ServerCapability>): string | null {
  let newest: string | null = null;
  for (const key of missingServerCapabilities(capabilities)) {
    const since = SERVER_CAPABILITIES[key];
    if (newest === null || !reaches(newest, since)) newest = since;
  }
  return newest;
}
