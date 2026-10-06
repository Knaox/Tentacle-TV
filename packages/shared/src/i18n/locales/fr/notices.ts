/**
 * Les avertissements surgissants des clients — web, bureau, mobile, iPad
 * (politique partagée : `notices/noticePolicy.ts`). Lus par le mobile : le
 * mot « téléchargement » n'y entre pas (garde-fou de `errorsVocabulary`).
 */
export default {
  close: "Fermer",
  undo: "Annuler",
  dismissForGood: "Ne plus afficher",
  // Le serveur Tentacle est plus ancien que ce client ne l'EXIGE (minServer) : bloquant.
  serverUpdateTitle: "Serveur Tentacle à mettre à jour",
  serverUpdateText: "Cette application exige le serveur Tentacle v{{required}} au moins ; le vôtre est en v{{server}}. Mettez-le à jour.",
  // `serverUpdateDismiss` / `serverUpdateDismissed` : plus affichées (l'obligatoire ne se masque plus), gardées.
  serverUpdateDismiss: "Ne plus afficher jusqu'à la prochaine mise à jour obligatoire",
  serverUpdateDismissed: "Masqué jusqu'à la prochaine mise à jour obligatoire.",
  serverUpdateHow: "Voir comment mettre à jour",
  // Le serveur atteint l'exigence, mais une nouveauté de cette application attend un serveur plus récent.
  serverNewsTitle: "Nouveautés disponibles",
  serverNewsText: "Pour profiter des dernières nouveautés, mettez à jour votre serveur Tentacle.",
  serverNewsDismiss: "Ne plus afficher jusqu'aux prochaines nouveautés",
  serverNewsDismissed: "Masqué jusqu'aux prochaines nouveautés.",
  // Aucune clé TMDB sur le serveur.
  tmdbKeyTitle: "Aucune clé TMDB",
  tmdbKeyText: "Sans elle, les recommandations restent génériques pour tous les comptes : ni « Pour vous », ni profil de goût, ni filtres par plateforme.",
  tmdbKeyAdd: "Ajouter la clé",
  tmdbKeyDismissed: "Masqué. L'information reste dans le tableau de bord.",
  // La clé d'administration Jellyfin ne marche plus.
  adminKeyTitle: "Clé d'administration Jellyfin hors service",
  adminKeyRevoked: "Jellyfin ne reconnaît plus la clé enregistrée : elle a été supprimée ou remplacée.",
  adminKeyNoRights: "La clé enregistrée n'a plus les droits d'administration sur Jellyfin.",
  adminKeyMissing: "Aucune clé d'administration Jellyfin n'est enregistrée.",
  adminKeyImpact: "La navigation fonctionne, mais les notifications d'ajouts, les invitations, la création de comptes et l'administration sont à l'arrêt.",
  adminKeyFix: "Renseigner une nouvelle clé",
} as const;
