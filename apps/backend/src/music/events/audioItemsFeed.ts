/**
 * Octave — le flux « éléments audio VUS » : chaque fois que l'index de la
 * musique apprend un ajout, une mise à jour ou un retrait (évènement d'une
 * socket de compte, ou passage complet), ses abonnés le reçoivent. Le runtime
 * des extensions s'y abonne pour pousser `jellyfin.audioItems` à l'invité
 * (docs/octave/CONTRATS.md, « Synchro temps réel ») ; l'émission des
 * `music:library` aux comptes en est un autre abonné.
 *
 * Un abonné qui lève n'empêche pas les autres : son erreur est journalisée.
 */

/** Identique à `AudioItemRef` de packages/shared/src/plugins/pluginServerRuntime.ts (test du miroir). */
export interface AudioItemRef {
  jellyfinId: string;
  recording: string | null;
  release: string | null;
  path: string | null;
}

export interface AudioItemsChange {
  added: AudioItemRef[];
  updated: AudioItemRef[];
  /** Identifiants Jellyfin retirés de la bibliothèque musique. */
  removed: string[];
}

export type AudioItemsListener = (change: AudioItemsChange) => void;

const listeners = new Set<AudioItemsListener>();

/** S'abonne ; rend la fonction qui désabonne. */
export function onAudioItems(listener: AudioItemsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishAudioItems(change: AudioItemsChange): void {
  if (change.added.length === 0 && change.updated.length === 0 && change.removed.length === 0) return;
  for (const listener of [...listeners]) {
    try {
      listener(change);
    } catch (error) {
      console.warn(`[music] abonné des éléments audio en erreur : ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export function resetAudioItemsFeedForTests(): void {
  listeners.clear();
}
