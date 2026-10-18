/**
 * Android TV n'a pas encore l'ouverture du démarrage (trait `brandIntro` faux) :
 * le son n'a rien à jouer. Le jour venu, ce jumeau lira le même fichier dérivé.
 */
export const bootSound = {
  /** Aucune mémoire native : l'appelant garde la sienne (Android TV n'a pas l'ouverture). */
  claimIntro(): boolean | null {
    return null;
  },
  async prepare(): Promise<boolean> {
    return false;
  },
  playAt(_hostMs: number): void {},
  fadeOut(_ms: number): void {},
  dispose(): void {},
};
