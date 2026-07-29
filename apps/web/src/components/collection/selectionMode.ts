/**
 * Contrat de la sélection multiple d'une grille de collection.
 *
 * Dans son propre fichier parce que trois modules le partagent désormais — la
 * grille, son corps virtualisé et sa carte — et qu'il était déclaré dans celui
 * qui a été découpé. Les pages l'importent toujours depuis `CollectionGrid`,
 * qui le ré-exporte.
 *
 * La sélection est portée par des IDENTIFIANTS, jamais par des index ni par les
 * cellules elles-mêmes : c'est ce qui lui permet de survivre au démontage des
 * cellules hors écran, que la virtualisation rend désormais courant.
 */
export interface SelectionMode {
  isSelecting: boolean;
  selected: Set<string>;
  toggle: (id: string) => void;
  isSelected: (id: string) => boolean;
}
