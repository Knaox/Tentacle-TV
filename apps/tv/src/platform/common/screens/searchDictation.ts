/** La dictée de la recherche, telle que la plateforme l'offre (`SearchView.dictation`). */
export interface SearchDictation {
  dictation: "system" | "key" | "systemAndKey";
  /** Le micro de l'app écoute. */
  listening?: boolean;
  onMic?: () => void;
}
