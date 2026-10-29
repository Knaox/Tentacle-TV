/**
 * Octave (mobile, web étroit) — les gestes au doigt sur une liste de titres et sur les playlists : mode
 * « Modifier », glisser, retirer, renommer. Le reste vient des espaces `music` (listOrder, playlistManage,
 * playlist), `musicImport` et `musicShare`. Jamais « téléchargement ».
 */
export default {
  edit: "Modifier",
  done: "OK",
  editHint: "Glissez la poignée pour changer l'ordre. Touchez « – » pour retirer un titre.",
  reorderHint: "Glissez la poignée pour changer l'ordre.",
  removeRow: "Retirer « {{title}} » de la playlist",
  moveUp: "Monter",
  moveDown: "Descendre",
  moved: "« {{title}} » déplacé en position {{position}}",
  rename: "Renommer",
  renameTitle: "Renommer la playlist",
  newTitle: "Nouvelle playlist",
  newHint: "Donnez-lui un nom ; vous y ajouterez des titres depuis le menu « ⋯ » d'un titre.",
  manage: "Gérer « {{name}} »",
  likedSubtitle_one: "{{count}} titre aimé",
  likedSubtitle_other: "{{count}} titres aimés",
  owner: "Par {{name}}",
  swipe: {
    remove: "Retirer",
    nextNotice: "Sera lu ensuite",
    queuedNotice: "Ajouté à la file d'attente",
    close: "Refermer les actions de « {{title}} »",
  },
};
