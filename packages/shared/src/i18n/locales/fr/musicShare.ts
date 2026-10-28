/**
 * Octave — partager une playlist par un lien (capacité `music.playlistShare`, droit « Partage public ») et
 * importer celle qu'un ami a partagée depuis SON Tentacle. Mobile compris : jamais « téléchargement ».
 */
export default {
  action: "Partager",
  title: "Partager « {{name}} »",
  intro: "Qui a ce lien voit le nom de la playlist et ses titres — jamais vos fichiers. Avec son propre Tentacle, il peut l'importer : chaque titre que sa bibliothèque a y entre.",
  create: "Créer le lien",
  creating: "Création du lien…",
  copy: "Copier le lien",
  copied: "Lien copié",
  shareSheet: "Envoyer le lien",
  revoke: "Ne plus partager",
  revoking: "Retrait du lien…",
  revoked: "Le lien ne marche plus.",
  revokeHint: "Le lien cesse aussitôt de marcher. Un nouveau partage en donnera un autre.",
  localOnly: "Ce lien n'utilise que l'adresse de la maison : il ne marchera pas ailleurs tant que le lien public du serveur n'est pas réglé.",
  localOnlyAdmin: "Régler l'accès à distance",
  failed: "Le lien n'a pas pu être créé. Réessayez dans un instant.",
  close: "Fermer",
  importTitle: "Playlist partagée",
  importLead: "Un ami vous a partagé une playlist depuis son Tentacle. Octave la recrée sur votre serveur, avec les titres de votre bibliothèque.",
};
