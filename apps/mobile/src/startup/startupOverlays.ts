/**
 * Les recouvrements du démarrage du mobile, DÉCLARÉS par leurs hôtes — pour
 * que ce qui vient après eux (l'invitation aux avatars) n'arrive qu'une fois
 * qu'ils ont tous tranché et se sont tus, au lieu de le deviner par un délai.
 *
 * Chaque hôte dit où il en est :
 * - `pending` : il n'a pas encore tranché (ses données ne sont pas arrivées) ;
 * - `active` : il montre quelque chose (affiche, avertissement, message,
 *   demande de permission du système…) ou va le montrer ;
 * - `quiet` : rien à montrer.
 * Un hôte démonté se tait. Les MODALES, elles, se déclarent au portier
 * (`components/ui/modalGate`) : ce registre ne les double pas.
 *
 * Trois recouvrements passent APRÈS tous les autres, dans un ordre fixe
 * (`LATE_STARTUP_OVERLAYS`) : le premier lancement d'un profil (code PIN,
 * accueil, photo), l'invitation aux avatars, puis « Action recommandée :
 * posez votre code PIN » — ces deux-là se taisent quand le premier lancement
 * les a déjà couverts. Chacun attend ceux d'avant
 * (`startupOverlaysQuietBefore`), jamais ceux d'après — sinon ils
 * s'attendraient l'un l'autre.
 *
 * Module PUR (ni React Native ni Expo) : testé sous vitest.
 */

export type StartupOverlayKey =
  /** Les avertissements de l'administrateur et les messages brefs (`NoticeHost`). */
  | "notices"
  /** L'affiche d'invitation de la Famille. */
  | "family"
  /** « Qui regarde ? » à l'ouverture (session de profil, serveur 1.31.1). */
  | "profiles"
  /** Les messages envoyés par l'administrateur à cet appareil. */
  | "messages"
  /** L'écran d'attente de la migration de la base du serveur. */
  | "migration"
  /** Le message du passage hors ligne. */
  | "connectivity"
  /** Une demande de permission du système (notifications). */
  | "permission"
  /** Le premier lancement d'un profil sur cet appareil — tardif : le premier des tardifs. */
  | "firstRun"
  /** L'invitation unique aux avatars — tardive : après le premier lancement. */
  | "avatars"
  /** « Action recommandée : posez votre code PIN » — tardive : après l'invitation aux avatars. */
  | "familyPin";

/** Les recouvrements tardifs, dans leur ordre de passage. */
export const LATE_STARTUP_OVERLAYS: readonly StartupOverlayKey[] = ["firstRun", "avatars", "familyPin"];

export type StartupOverlayState = "pending" | "active" | "quiet";

const reported = new Map<StartupOverlayKey, StartupOverlayState>();
const holds = new Map<StartupOverlayKey, number>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** L'état qu'un hôte déclare ; le même deux fois de suite ne réveille personne. */
export function reportStartupOverlay(key: StartupOverlayKey, state: StartupOverlayState): void {
  if ((reported.get(key) ?? "quiet") === state) return;
  if (state === "quiet") reported.delete(key);
  else reported.set(key, state);
  emit();
}

/**
 * Un recouvrement le temps d'une opération (une demande de permission) : actif
 * jusqu'à ce que le retour le libère — idempotent, et plusieurs se cumulent.
 */
export function holdStartupOverlay(key: StartupOverlayKey): () => void {
  holds.set(key, (holds.get(key) ?? 0) + 1);
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (holds.get(key) ?? 1) - 1;
    if (left <= 0) holds.delete(key);
    else holds.set(key, left);
    emit();
  };
}

/** Les recouvrements qui ne se sont pas tus (diagnostic, tests). */
export function busyStartupOverlays(): StartupOverlayKey[] {
  const busy = new Set<StartupOverlayKey>([...reported.keys(), ...holds.keys()]);
  return [...busy].sort();
}

/** Tous ont tranché et se sont tus. */
export function startupOverlaysQuiet(): boolean {
  return reported.size === 0 && holds.size === 0;
}

/**
 * `other` passe-t-il avant `key` ? Un recouvrement ordinaire n'attend que les
 * ordinaires ; un tardif attend les ordinaires et les tardifs qui le précèdent.
 */
function comesBefore(other: StartupOverlayKey, key: StartupOverlayKey): boolean {
  if (other === key) return false;
  const otherRank = LATE_STARTUP_OVERLAYS.indexOf(other);
  const keyRank = LATE_STARTUP_OVERLAYS.indexOf(key);
  return keyRank < 0 ? otherRank < 0 : otherRank < keyRank;
}

/** Tous ceux qui passent avant `key` ont tranché et se sont tus. */
export function startupOverlaysQuietBefore(key: StartupOverlayKey): boolean {
  return busyStartupOverlays().every((other) => !comesBefore(other, key));
}

export function subscribeStartupOverlays(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tests seulement : un registre vierge. */
export function resetStartupOverlays(): void {
  reported.clear();
  holds.clear();
  emit();
}
