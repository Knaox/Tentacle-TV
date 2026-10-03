/**
 * Les avertissements surgissants des clients — web, bureau, mobile, iPad
 * (politique partagée : `notices/noticePolicy.ts`). Lus par le mobile : le
 * mot « téléchargement » n'y entre pas (garde-fou de `errorsVocabulary`).
 */
export default {
  close: "Fermer",
  undo: "Annuler",
  dismissForGood: "Ne plus afficher",
  // Le serveur Tentacle est plus ancien que ce client ne l'exige.
  serverUpdateTitle: "Serveur Tentacle à mettre à jour",
  serverUpdateText: "Votre serveur (v{{server}}) est plus ancien que ce que demande cette application (v{{required}} au moins) : certaines fonctions pourraient ne pas marcher.",
  serverUpdateDismiss: "Ne plus afficher jusqu'à la prochaine mise à jour obligatoire",
  serverUpdateDismissed: "Masqué jusqu'à la prochaine mise à jour obligatoire.",
  serverUpdateHow: "Voir comment mettre à jour",
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
