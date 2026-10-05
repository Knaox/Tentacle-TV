import { TV_ENROLL_PENDING_KEY, TV_KNOWN_PROFILES_KEY, TV_PAIRING_TOKEN_KEY, TV_PROFILE_KEY, TV_PROFILES_LISTING_KEY } from "./tvProfileKeys";

/**
 * Le déjumelage d'un téléviseur, tel qu'il survit à un plantage.
 *
 * Un déjumelage a deux moitiés que rien ne peut rendre atomiques ensemble :
 * effacer ce que l'appareil sait du compte, et faire oublier son jeton au
 * serveur. La première est locale et doit être IMMÉDIATE — l'utilisateur qui
 * déjumelle ne doit plus rien voir de son compte, serveur joignable ou non. La
 * seconde dépend du réseau et peut attendre des jours.
 *
 * Un seul marqueur persistant, `UNPAIR_PENDING_KEY`, tient les deux :
 * - `wiping` : une purge a commencé. Il est écrit AVANT le premier effacement
 *   et levé APRÈS le dernier ; trouvé levé au démarrage, la purge est rejouée
 *   en entier (elle est idempotente). Une app tuée au milieu ne repart donc
 *   jamais à moitié jumelée.
 * - `revocations` : les anciens jetons mis de côté, avec leur serveur, tant que
 *   celui-ci n'a pas confirmé les avoir oubliés. C'est la seule copie qui
 *   reste du jeton : rien d'autre ne la lit (`revocationDrain.ts` l'envoie).
 *
 * Un rejumelage pendant qu'une révocation attend ne touche pas au marqueur :
 * la nouvelle session vit dans ses propres clés, et la purge n'est rejouée que
 * si `wiping` est levé — jamais sur la seule présence de révocations.
 *
 * La Famille (Apple TV) ajoute une purge plus petite : QUITTER UN PROFIL
 * (`beginProfileLeave`, portée `profile`) efface la session du profil
 * (`PROFILE_STORAGE_KEYS`) et met son jeton de côté, mais garde le jumelage —
 * le jeton de jumelage, qui ouvre les autres profils.
 *
 * Module pur, stockage injecté : `localStorage` côté LG, `RNStorageAdapter`
 * côté natif (synchrone une fois hydraté). L'ordre des écritures est celui des
 * appels sur les deux : le marqueur est sur le disque avant le premier
 * effacement.
 */

/** Clé du marqueur. Nouvelle : elle n'existait sur aucun appareil avant lui. */
export const UNPAIR_PENDING_KEY = "tentacle_unpair_pending";

/**
 * Ce qui appartient à la SESSION ouverte — le compte d'un jumelage d'avant les
 * profils, ou le profil ouvert sur une Apple TV passée aux profils (Famille).
 * Quitter un profil n'efface QUE ceci (`beginProfileLeave`) : la TV reste
 * jumelée. Les réglages de l'APPAREIL restent (langue de l'interface, rail,
 * verre, réglages matériels du lecteur, identifiant d'appareil) — ils servent
 * dès l'écran de jumelage et ne disent rien du compte.
 *
 * Aucune de ces clés n'est renommée : ce sont celles que les applications
 * écrivent déjà.
 */
export const PROFILE_STORAGE_KEYS: readonly string[] = [
  "tentacle_token",
  "tentacle_user",
  "tentacle_jellyfin_token",
  "tentacle_jellyfin_url",
  "tentacle_credentials",
  // L'identité Jellyfin que le serveur a dérivée pour CE jumelage (ou cette session de profil).
  "tentacle_device_id_jf",
  // Le cache persisté des requêtes : les hubs de l'accueil du compte.
  "tentacle_query_cache_v1",
  "tentacle_recent_searches",
  // Le cache local des réglages de lecture du COMPTE (le serveur les garde).
  "tentacle_playback_settings",
  // La file persistée des rapports de lecture (`OUTBOX_KEY`, api-client) : des
  // positions du compte, jamais rejouées avec le jeton d'un autre.
  "tentacle_playback_outbox",
  // Le marqueur de la relance à froid (`PLAYBACK_MARKER_KEY`, `playback/coldStart`).
  "tentacle_playback_marker",
  // Le profil de la session ouverte (Famille, Apple TV).
  TV_PROFILE_KEY,
];

/**
 * Ce que le DÉJUMELAGE efface : la session, et ce qui tient le jumelage
 * lui-même — le jeton de jumelage d'une TV passée aux profils, et ce qu'elle
 * retient de sa famille.
 */
export const ACCOUNT_STORAGE_KEYS: readonly string[] = [
  ...PROFILE_STORAGE_KEYS,
  TV_PAIRING_TOKEN_KEY,
  TV_KNOWN_PROFILES_KEY,
  TV_PROFILES_LISTING_KEY,
  TV_ENROLL_PENDING_KEY,
];

/** Le minimum qu'un stockage doit offrir, synchrone. */
export interface SessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Un ancien jeton que son serveur n'a pas encore confirmé avoir oublié. */
export interface PendingRevocation {
  serverUrl: string;
  token: string;
  /** Moment du déjumelage (ms). */
  since: number;
  /** Tentatives déjà faites. */
  attempts: number;
  /** Pas de nouvelle tentative avant ce moment (ms). */
  notBefore: number;
}

export interface UnpairJournal {
  wiping: boolean;
  /** `profile` : la purge en cours ne quitte qu'un PROFILE (Famille) — la TV
   *  reste jumelée ; absente : un déjumelage. */
  scope?: "profile";
  revocations: PendingRevocation[];
}

/** La session qu'on quitte : de quoi demander sa révocation. */
export interface LeavingSession {
  serverUrl: string | null;
  token: string | null;
}

/** Au-delà, les plus anciennes cèdent la place : le marqueur reste petit. */
export const MAX_PENDING_REVOCATIONS = 16;

function isRevocation(value: unknown): value is PendingRevocation {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return typeof r.serverUrl === "string" && r.serverUrl !== ""
    && typeof r.token === "string" && r.token !== ""
    && typeof r.since === "number" && typeof r.attempts === "number" && typeof r.notBefore === "number";
}

/**
 * Le marqueur tel qu'il est. Illisible, il ne peut venir que d'un déjumelage
 * interrompu : on le traite comme une purge à refaire, sans révocation (les
 * jetons qu'il portait sont perdus, donc détruits — leur ligne serveur reste
 * supprimable depuis la liste des appareils).
 */
export function readUnpairJournal(storage: SessionStorage): UnpairJournal {
  const raw = storage.getItem(UNPAIR_PENDING_KEY);
  if (raw === null || raw === "") return { wiping: false, revocations: [] };
  try {
    const parsed = JSON.parse(raw) as { wiping?: unknown; scope?: unknown; revocations?: unknown };
    const revocations = Array.isArray(parsed.revocations) ? parsed.revocations.filter(isRevocation) : [];
    const wiping = parsed.wiping === true;
    return wiping && parsed.scope === "profile" ? { wiping, scope: "profile", revocations } : { wiping, revocations };
  } catch {
    return { wiping: true, revocations: [] };
  }
}

/** Écrit le marqueur ; rien à faire ni à envoyer : il disparaît. */
export function writeUnpairJournal(storage: SessionStorage, journal: UnpairJournal): void {
  if (!journal.wiping && journal.revocations.length === 0) {
    storage.removeItem(UNPAIR_PENDING_KEY);
    return;
  }
  storage.setItem(UNPAIR_PENDING_KEY, JSON.stringify(journal));
}

/**
 * Premier geste d'un déjumelage, AVANT tout effacement : la purge est
 * déclarée en cours et le jeton quitté mis de côté pour sa révocation.
 * `leaving` nul (révocation venue du serveur) : rien à révoquer.
 */
export function beginUnpair(storage: SessionStorage, leaving: LeavingSession | null, now: number): void {
  writeUnpairJournal(storage, { wiping: true, revocations: withLeaving(readUnpairJournal(storage), leaving, now) });
}

/**
 * Premier geste quand on QUITTE UN PROFILE (Famille, Apple TV), AVANT tout
 * effacement : la purge de la session est déclarée en cours — rejouée au
 * démarrage sur les seules clés de la session (`PROFILE_STORAGE_KEYS`), la TV
 * restant jumelée — et le jeton de la session mis de côté pour sa révocation
 * (la même route : portée par une session de profil, elle ne ferme qu'elle).
 * Un déjumelage déjà en cours n'est jamais rétrogradé en simple sortie.
 */
export function beginProfileLeave(storage: SessionStorage, leaving: LeavingSession | null, now: number): void {
  const journal = readUnpairJournal(storage);
  const revocations = withLeaving(journal, leaving, now);
  const accountPending = journal.wiping && journal.scope !== "profile";
  writeUnpairJournal(storage, accountPending ? { wiping: true, revocations } : { wiping: true, scope: "profile", revocations });
}

/** Les révocations du marqueur, le jeton quitté en plus (une fois). */
function withLeaving(journal: UnpairJournal, leaving: LeavingSession | null, now: number): PendingRevocation[] {
  const serverUrl = leaving?.serverUrl?.trim();
  const token = leaving?.token?.trim();
  const revocations = [...journal.revocations];
  if (serverUrl && token && !revocations.some((r) => r.token === token)) {
    revocations.push({ serverUrl, token, since: now, attempts: 0, notBefore: now });
  }
  return revocations.slice(-MAX_PENDING_REVOCATIONS);
}

/** Efface ce qui appartient au compte. Idempotent. */
export function wipeAccount(storage: SessionStorage, keys: readonly string[] = ACCOUNT_STORAGE_KEYS): void {
  for (const key of keys) storage.removeItem(key);
}

/** Dernier geste de la purge : elle n'est plus à refaire. */
export function endWipe(storage: SessionStorage): void {
  const journal = readUnpairJournal(storage);
  writeUnpairJournal(storage, { wiping: false, revocations: journal.revocations });
}

/**
 * Au démarrage, avant que quoi que ce soit lise la session : une purge
 * interrompue est rejouée. Rend `true` si c'était un déjumelage — l'appareil
 * est alors à jumeler. La sortie d'un profil interrompue n'efface que la
 * session (`profileKeys`) : la TV reste jumelée, et rend `false`.
 */
export function resumeUnpair(
  storage: SessionStorage,
  keys: readonly string[] = ACCOUNT_STORAGE_KEYS,
  profileKeys: readonly string[] = PROFILE_STORAGE_KEYS,
): boolean {
  const journal = readUnpairJournal(storage);
  if (!journal.wiping) return false;
  const unpairing = journal.scope !== "profile";
  wipeAccount(storage, unpairing ? keys : profileKeys);
  endWipe(storage);
  return unpairing;
}

/** Le serveur a confirmé : le jeton mis de côté est détruit. */
export function settleRevocation(storage: SessionStorage, token: string): void {
  const journal = readUnpairJournal(storage);
  writeUnpairJournal(storage, { ...journal, revocations: journal.revocations.filter((r) => r.token !== token) });
}

/** Échec : la tentative est comptée et la suivante repoussée de `delayMs`. */
export function deferRevocation(storage: SessionStorage, token: string, now: number, delayMs: number): void {
  const journal = readUnpairJournal(storage);
  writeUnpairJournal(storage, {
    ...journal,
    revocations: journal.revocations.map((r) =>
      r.token === token ? { ...r, attempts: r.attempts + 1, notBefore: now + delayMs } : r,
    ),
  });
}
