import type { FamilyProfileKind } from "@tentacle-tv/shared";
import type { ProfileLaunch, TvProfileRecord } from "./tvProfileSession";
import type { SessionStorage } from "./unpairJournal";

/**
 * L'étape « Code PIN conseillé » du PREMIER PASSAGE dans un profil (Apple TV,
 * Android TV) — la première fenêtre du démarrage (`nav/startupWindows`), avant
 * la barre et la photo. Module pur, stockage injecté.
 *
 * - Pour qui : le propriétaire ou un membre de la famille — parent, membre
 *   simple ou mineur, qu'il gère quelque chose ou non —, sur un profil SANS
 *   code. Jamais un invité (son code est celui que pose son propriétaire,
 *   `ownPinModes`) ; jamais le compte seul ouvert d'office (`solo` : aucune
 *   famille, personne d'autre devant l'écran — la règle du web,
 *   `familyPinReminder`). Le compte de démonstration (le serveur lui refuse
 *   tout code) en est toujours : seul, sans famille ni code (`isDemoProfile`).
 * - Une fois par profil et par appareil : « Plus tard » la marque
 *   (`PIN_SETUP_STORAGE_KEY`) ; un code posé la rend sans objet. Elle ne
 *   revient plus — le code se pose ensuite dans Réglages › Compte.
 * - Hors ligne : rien, et rien n'est marqué — la pose part au serveur ; elle
 *   sera proposée au passage suivant.
 *
 * Le code est le même partout, un par compte : posé ici, il vaut sur toutes
 * les TV et sur le bureau, et il ouvre la gestion de la famille.
 */

/** `{ [userId]: horodatage } ` — les profils à qui l'étape a été proposée sur cet appareil. ⚠️ Clé stockée : ne pas renommer. */
export const PIN_SETUP_STORAGE_KEY = "tentacle_tv_pin_setup";

/** Ce que l'étape lit du profil ouvert (le profil retenu de la TV, `TvProfileRecord`). */
export interface PinSetupSubject {
  kind: FamilyProfileKind;
  hasPin: boolean;
  launch: ProfileLaunch;
  /** Il gérerait avec un code (`TvProfileDto.manageNeedsPin`, serveur 1.30.0). */
  manageNeedsPin?: boolean;
}

/** Ce que l'étape lit du profil retenu de la TV. */
export function pinSetupSubjectOf(record: TvProfileRecord): PinSetupSubject {
  return { kind: record.kind, hasPin: record.hasPin, launch: record.launch, manageNeedsPin: record.manageNeedsPin };
}

/** Le profil est-il de ceux à qui l'on conseille un code ? */
export function pinSetupEligible(subject: PinSetupSubject | null): boolean {
  return !!subject && subject.kind !== "guest" && !subject.hasPin && subject.launch !== "solo";
}

/** Pourquoi le code : protéger le profil — et, pour qui gérerait avec un code, gérer la famille depuis la TV. */
export type PinSetupReason = "protect" | "protectAndManage";

export function pinSetupReason(subject: Pick<PinSetupSubject, "manageNeedsPin">): PinSetupReason {
  return subject.manageNeedsPin === true ? "protectAndManage" : "protect";
}

/** L'étape reste-t-elle à proposer (lecture synchrone, pour le registre du démarrage) ? */
export function isPinSetupPending(input: { subject: PinSetupSubject | null; offered: boolean }): boolean {
  return !input.offered && pinSetupEligible(input.subject);
}

export type PinSetupEntry = "show" | "skip";

/** À l'arrivée sur l'étape : la montrer, ou passer (sans rien marquer) — hors ligne, la pose ne partirait pas. */
export function pinSetupEntry(input: { pending: boolean; online: boolean }): PinSetupEntry {
  return input.pending && input.online ? "show" : "skip";
}

function readOffers(storage: SessionStorage): Record<string, number> {
  const raw = storage.getItem(PIN_SETUP_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const offers: Record<string, number> = {};
    for (const [userId, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (userId && typeof at === "number") offers[userId] = at;
    }
    return offers;
  } catch {
    return {};
  }
}

/** L'étape a-t-elle déjà été proposée à ce profil sur cet appareil ? */
export function readPinSetupOffered(storage: SessionStorage, userId: string): boolean {
  return userId in readOffers(storage);
}

/** « Plus tard » : l'étape ne reviendra plus pour ce profil sur cet appareil. */
export function markPinSetupOffered(storage: SessionStorage, userId: string, now: number): void {
  if (!userId) return;
  storage.setItem(PIN_SETUP_STORAGE_KEY, JSON.stringify({ ...readOffers(storage), [userId]: now }));
}

/** Oublie que l'étape a été proposée à ce profil sur cet appareil (« Reproposer le code PIN et la
 *  photo », `promptsReset`) : elle reviendra s'il n'a toujours pas de code. */
export function forgetPinSetupOffered(storage: SessionStorage, userId: string): void {
  const offers = readOffers(storage);
  if (!(userId in offers)) return;
  delete offers[userId];
  storage.setItem(PIN_SETUP_STORAGE_KEY, JSON.stringify(offers));
}
