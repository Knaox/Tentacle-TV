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
 * Module pur, stockage injecté : `localStorage` côté LG, `RNStorageAdapter`
 * côté natif (synchrone une fois hydraté). L'ordre des écritures est celui des
 * appels sur les deux : le marqueur est sur le disque avant le premier
 * effacement.
 */

/** Clé du marqueur. Nouvelle : elle n'existait sur aucun appareil avant lui. */
export const UNPAIR_PENDING_KEY = "tentacle_unpair_pending";

/**
 * Ce que la purge efface : tout ce qui appartient au compte jumelé. Les
 * réglages de l'APPAREIL restent (langue de l'interface, rail, verre, réglages
 * matériels du lecteur, identifiant d'appareil) — ils servent dès l'écran de
 * jumelage et ne disent rien du compte.
 *
 * Aucune de ces clés n'est renommée : ce sont celles que les applications
 * écrivent déjà.
 */
export const ACCOUNT_STORAGE_KEYS: readonly string[] = [
  "tentacle_token",
  "tentacle_user",
  "tentacle_jellyfin_token",
  "tentacle_jellyfin_url",
  "tentacle_credentials",
  // L'identité Jellyfin que le serveur a dérivée pour CE jumelage.
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
    const parsed = JSON.parse(raw) as { wiping?: unknown; revocations?: unknown };
    const revocations = Array.isArray(parsed.revocations) ? parsed.revocations.filter(isRevocation) : [];
    return { wiping: parsed.wiping === true, revocations };
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
  const journal = readUnpairJournal(storage);
  const serverUrl = leaving?.serverUrl?.trim();
  const token = leaving?.token?.trim();
  if (serverUrl && token && !journal.revocations.some((r) => r.token === token)) {
    journal.revocations.push({ serverUrl, token, since: now, attempts: 0, notBefore: now });
  }
  const revocations = journal.revocations.slice(-MAX_PENDING_REVOCATIONS);
  writeUnpairJournal(storage, { wiping: true, revocations });
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
 * interrompue est rejouée. Rend `true` si c'était le cas — l'appareil est
 * alors à jumeler.
 */
export function resumeUnpair(storage: SessionStorage, keys: readonly string[] = ACCOUNT_STORAGE_KEYS): boolean {
  if (!readUnpairJournal(storage).wiping) return false;
  wipeAccount(storage, keys);
  endWipe(storage);
  return true;
}

/** Le serveur a confirmé : le jeton mis de côté est détruit. */
export function settleRevocation(storage: SessionStorage, token: string): void {
  const journal = readUnpairJournal(storage);
  writeUnpairJournal(storage, {
    wiping: journal.wiping,
    revocations: journal.revocations.filter((r) => r.token !== token),
  });
}

/** Échec : la tentative est comptée et la suivante repoussée de `delayMs`. */
export function deferRevocation(storage: SessionStorage, token: string, now: number, delayMs: number): void {
  const journal = readUnpairJournal(storage);
  writeUnpairJournal(storage, {
    wiping: journal.wiping,
    revocations: journal.revocations.map((r) =>
      r.token === token ? { ...r, attempts: r.attempts + 1, notBefore: now + delayMs } : r,
    ),
  });
}
