/**
 * Les réglages de lecture qui appartiennent à l'APPAREIL, et le magasin qui les
 * tient.
 *
 * # Pourquoi par appareil et non par compte
 *
 * Ces trois-là se décident devant l'écran, pas dans un profil. On enchaîne les
 * épisodes le soir sur le téléviseur du salon ; on reprend une série de loin en
 * loin sur le portable, et l'on n'y veut pas les mêmes automatismes. Le
 * stockage local a de surcroît l'avantage de répondre HORS LIGNE, là où une
 * préférence serveur laisserait le lecteur sans réponse au moment précis où il
 * doit décider.
 *
 * # Pourquoi ici, dans le paquet partagé
 *
 * Il y a deux magasins — `localStorage` côté navigateur, ordinateur et LG ;
 * l'adaptateur natif côté Apple TV et Android TV — mais il ne doit y avoir
 * qu'un jeu de CLÉS et qu'un jeu de DÉFAUTS. Les dédoubler, c'est se réveiller
 * un jour avec un réglage allumé sur trois plateformes et éteint sur la
 * quatrième, sans qu'aucun type ne bronche.
 *
 * `@tentacle-tv/shared` est le seul paquet dont les deux côtés dépendent déjà,
 * et ce module n'a besoin ni de React ni du DOM.
 */

/** Les clés de stockage. Mêmes chaînes sur les cinq cibles. */
export const CLES_REGLAGE_APPAREIL = {
  /** « Passer l'intro automatiquement ». */
  sautIntroAuto: "tentacle_auto_skip_intro",
  /** La petite carte « à suivre », proposée pendant le générique. */
  carteASuivre: "tentacle_up_next_card",
  /** Le compte à rebours qui enchaîne tout seul sur l'épisode suivant. */
  decompteEnchainement: "tentacle_up_next_countdown",
} as const;

export type CleReglageAppareil =
  (typeof CLES_REGLAGE_APPAREIL)[keyof typeof CLES_REGLAGE_APPAREIL];

/**
 * Les trois sont ALLUMÉS par défaut, et c'est un choix de produit : on veut
 * l'expérience complète sans avoir rien à régler, et chacun de ces automatismes
 * reste réfutable sur le moment — une croix sur la pilule, une croix sur la
 * carte. Ce qui s'éteint, l'utilisateur l'éteint.
 */
export const DEFAUT_REGLAGE_APPAREIL = true;

/** Le minimum qu'un stockage doit offrir. `localStorage` et l'adaptateur natif
 *  le satisfont tous les deux. */
export interface StockageAppareil {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

export interface MagasinBooleen {
  sAbonner(rappel: () => void): () => void;
  lireInstantane(): boolean;
  definir(actif: boolean): void;
  /**
   * Android TV lit un cache rempli par un `hydrate()` asynchrone au démarrage :
   * le premier instantané peut précéder la vraie valeur.
   */
  rehydrater(): void;
}

/**
 * Un réglage booléen, adossé au stockage qu'on lui donne.
 *
 * Le défaut est porté par une COMPARAISON et non par une valeur écrite : rien
 * n'est posé au premier démarrage, et c'est l'absence de refus qui allume.
 * Corollaire à ne pas défaire : avec un défaut à vrai, seule la chaîne
 * `"false"` éteint — écrire `=== "true"` éteindrait le réglage pour tout le
 * monde, en silence.
 */
export function creerMagasinBooleen(
  stockage: StockageAppareil,
  cle: string,
  defaut: boolean = DEFAUT_REGLAGE_APPAREIL,
): MagasinBooleen {
  const auditeurs = new Set<() => void>();

  const lireStockage = (): boolean => {
    try {
      const brut = stockage.getItem(cle);
      if (brut === "true") return true;
      if (brut === "false") return false;
      return defaut;
    } catch {
      // Stockage illisible : on rend le défaut, comme si rien n'avait été posé.
      return defaut;
    }
  };

  let instantane = lireStockage();

  return {
    sAbonner(rappel) {
      auditeurs.add(rappel);
      return () => {
        auditeurs.delete(rappel);
      };
    },
    lireInstantane: () => instantane,
    definir(actif) {
      if (actif === instantane) return;
      instantane = actif;
      try {
        stockage.setItem(cle, String(actif));
      } catch {
        // Stockage indisponible : le réglage vaut pour cette session.
      }
      auditeurs.forEach((auditeur) => auditeur());
    },
    rehydrater() {
      const lu = lireStockage();
      if (lu === instantane) return;
      instantane = lu;
      auditeurs.forEach((auditeur) => auditeur());
    },
  };
}
