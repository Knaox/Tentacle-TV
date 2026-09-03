/**
 * Les événements du moteur : « un pool vient d'être écrit », « un profil
 * vient d'être reconstruit ». Un registre de listeners maison (pas
 * d'EventEmitter, doctrine du dépôt) pour que les jobs de page s'abonnent
 * sans que la génération ne les importe — sinon pageJobs → generationJob →
 * pageJobs, le cycle.
 */
type UserListener = (userId: string) => void;

const poolListeners = new Set<UserListener>();
const profileListeners = new Set<UserListener>();

function emit(listeners: Set<UserListener>, userId: string, what: string): void {
  for (const listener of listeners) {
    try {
      listener(userId);
    } catch (err) {
      console.error(`[Reco] Listener ${what} en échec :`, err);
    }
  }
}

export function onPoolWritten(listener: UserListener): () => void {
  poolListeners.add(listener);
  return () => poolListeners.delete(listener);
}

/** Appelé par la génération après writePool — complète ou préliminaire. */
export function emitPoolWritten(userId: string): void {
  emit(poolListeners, userId, "poolWritten");
}

export function onProfileRebuilt(listener: UserListener): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

/** Appelé par profileBuilder après l'écriture de taste_profiles. */
export function emitProfileRebuilt(userId: string): void {
  emit(profileListeners, userId, "profileRebuilt");
}
