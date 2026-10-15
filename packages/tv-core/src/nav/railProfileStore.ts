import { RAIL_STORAGE_KEY, type RailPinningStore, type RailStorage } from "./railPinning";
import { sameRailOrder } from "./railOrder";
import {
  RAIL_PROFILES_STORAGE_KEY,
  parseDeviceRail,
  parseProfileRails,
  profileRailOf,
  sameProfileRail,
  serializeProfileRails,
  type ProfileRailEntry,
  type ProfileRails,
  type RailLayout,
} from "./railProfiles";

/**
 * Le magasin du rail PAR PROFIL (Apple TV, Android TV) — format :
 * `railProfiles.ts`.
 *
 * Il offre EXACTEMENT l'interface du magasin d'appareil (`RailPinningStore`) :
 * `createUseRailPinning` s'y branche tel quel, et tout ce qui édite le rail
 * (le catalogue, les gestes du rail, Réglages › Navigation) édite d'office la
 * disposition de l'identité ACTIVE. L'identité est lue par `readIdentity`
 * (injectée : le compte de `tentacle_user` côté TV) ; elle change, la
 * disposition suit, sans redémarrage — `syncIdentity` réveille les abonnés,
 * et chaque lecture de l'instantané la revérifie (filet : un écran monté
 * après un changement de profil lit la bonne disposition).
 *
 * Sans identité (pas de session) : la disposition d'appareil, comme avant.
 *
 * Module pur : le stockage et l'identité sont injectés.
 */

/** La disposition servie : celle de l'identité active. */
export interface ActiveRail extends ProfileRailEntry {
  /** null : pas de session — la disposition d'appareil. */
  identity: string | null;
}

export interface ProfileRailStore extends RailPinningStore {
  readSnapshot: () => ActiveRail;
  /** Toutes les entrées par identité — même référence entre deux écritures. */
  readProfiles: () => ProfileRails;
  /** Relit l'identité active ; notifie si elle a changé depuis la dernière notification. */
  syncIdentity: () => void;
  /** Ce qu'une identité voit (la sienne, sinon l'héritée — non faite). */
  layoutOf: (userId: string) => ProfileRailEntry;
  /** La préconfiguration : enregistre la disposition choisie et la marque faite. */
  completeSetup: (userId: string, layout: RailLayout) => void;
  /** « Plus tard » / « Passer » : marque faite, garde la disposition héritée. */
  skipSetup: (userId: string) => void;
  /** Copie la disposition de `fromUserId` chez chacun des autres, préconfiguration marquée faite. */
  applyLayoutTo: (fromUserId: string, toUserIds: readonly string[]) => void;
}

export interface ProfileRailStoreKeys {
  profiles: string;
  device: string;
}

const DEFAULT_KEYS: ProfileRailStoreKeys = { profiles: RAIL_PROFILES_STORAGE_KEY, device: RAIL_STORAGE_KEY };

/** Le JSON d'appareil, à l'octet près celui de `railPinning.ts` (la LG le lit). */
function serializeDevice(layout: RailLayout): string {
  return JSON.stringify(layout.order.length > 0 ? { masquees: layout.masquees, order: layout.order } : { masquees: layout.masquees });
}

const copyOf = (layout: RailLayout): RailLayout => ({ masquees: [...layout.masquees], order: [...layout.order] });

export function createProfileRailStore(
  storage: RailStorage,
  readIdentity: () => string | null,
  keys: ProfileRailStoreKeys = DEFAULT_KEYS,
): ProfileRailStore {
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());

  const safeRead = (key: string): string | null => {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };
  const safeIdentity = (): string | null => {
    try {
      return readIdentity() || null;
    } catch {
      return null;
    }
  };

  let rawRails = safeRead(keys.profiles);
  let rails: ProfileRails = parseProfileRails(rawRails);
  let device: RailLayout = parseDeviceRail(safeRead(keys.device));
  let identity = safeIdentity();
  /** La dernière identité ANNONCÉE aux abonnés — `readSnapshot` peut changer `identity` sans notifier. */
  let notifiedIdentity = identity;

  const compute = (): ActiveRail =>
    identity
      ? { ...profileRailOf(rails, device, identity), identity }
      : { masquees: device.masquees, order: device.order, setupDone: false, identity: null };
  let snapshot = compute();

  const readSnapshot = (): ActiveRail => {
    const current = safeIdentity();
    if (current !== identity) {
      identity = current;
      snapshot = compute();
    }
    return snapshot;
  };

  const writeRails = (next: ProfileRails): void => {
    rails = next;
    rawRails = serializeProfileRails(next);
    try {
      storage.setItem(keys.profiles, rawRails);
    } catch {
      // Stockage indisponible : la disposition vaut pour cette session.
    }
    snapshot = compute();
    notify();
  };

  /** Modifie la disposition ACTIVE ; `null` : rien à changer. */
  const editActive = (change: (current: RailLayout) => RailLayout | null): void => {
    const current = readSnapshot();
    const next = change(current);
    if (!next) return;
    if (current.identity === null) {
      device = next;
      try {
        storage.setItem(keys.device, serializeDevice(next));
      } catch {
        // idem
      }
      snapshot = compute();
      notify();
      return;
    }
    writeRails({ ...rails, [current.identity]: { ...next, setupDone: current.setupDone } });
  };

  const layoutOf = (userId: string): ProfileRailEntry => profileRailOf(rails, device, userId);

  return {
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    readSnapshot,
    readProfiles: () => rails,
    isHidden: (entryKey) => readSnapshot().masquees.includes(entryKey),
    toggle(entryKey) {
      editActive(({ masquees, order }) => ({
        masquees: masquees.includes(entryKey) ? masquees.filter((other) => other !== entryKey) : masquees.concat(entryKey),
        order,
      }));
    },
    showAll() {
      editActive(({ masquees, order }) => (masquees.length === 0 ? null : { masquees: [], order }));
    },
    setOrder(order) {
      editActive((current) => (sameRailOrder(order, current.order) ? null : { masquees: current.masquees, order: [...order] }));
    },
    resetOrder() {
      editActive(({ masquees, order }) => (order.length === 0 ? null : { masquees, order: [] }));
    },
    syncIdentity() {
      readSnapshot();
      if (identity === notifiedIdentity) return;
      notifiedIdentity = identity;
      notify();
    },
    rehydrate() {
      const nextRaw = safeRead(keys.profiles);
      const nextDevice = parseDeviceRail(safeRead(keys.device));
      const before = snapshot;
      const railsChanged = nextRaw !== rawRails;
      if (railsChanged) {
        rawRails = nextRaw;
        rails = parseProfileRails(nextRaw);
      }
      device = nextDevice;
      identity = safeIdentity();
      snapshot = compute();
      const same = before.identity === snapshot.identity && sameProfileRail(before, snapshot);
      if (same && !railsChanged) {
        snapshot = before;
        return;
      }
      notifiedIdentity = identity;
      notify();
    },
    layoutOf,
    completeSetup(userId, layout) {
      if (!userId) return;
      writeRails({ ...rails, [userId]: { ...copyOf(layout), setupDone: true } });
    },
    skipSetup(userId) {
      if (!userId) return;
      const entry = layoutOf(userId);
      if (entry.setupDone && rails[userId]) return;
      // L'héritée devient la sienne : figée telle qu'il l'a vue en passant.
      writeRails({ ...rails, [userId]: { ...copyOf(entry), setupDone: true } });
    },
    applyLayoutTo(fromUserId, toUserIds) {
      if (!fromUserId) return;
      const source = layoutOf(fromUserId);
      const targets = toUserIds.filter((userId) => userId && userId !== fromUserId);
      if (targets.length === 0) return;
      const next: Record<string, ProfileRailEntry> = { ...rails };
      for (const userId of targets) next[userId] = { ...copyOf(source), setupDone: true };
      writeRails(next);
    },
  };
}
