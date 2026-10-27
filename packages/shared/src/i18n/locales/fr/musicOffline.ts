/**
 * Octave — la musique gardée sur l'appareil (bureau, capacité `offline.music`).
 *
 * ⚠️ Le vocabulaire est celui du hors ligne (`offline`) : « garder hors ligne », « sur cet appareil » — jamais
 * « téléchargement » ni « télécharger » (`musicOfflineVocabulary.test.ts`), et aucune source nommée.
 */
export default {
  keep: "Garder hors ligne",
  keepAlbum: "Garder l'album hors ligne",
  keepPlaylist: "Garder la playlist hors ligne",
  keepMissing_one: "Garder le titre qui manque",
  keepMissing_other: "Garder les {{count}} titres qui manquent",
  remove: "Retirer de cet appareil",
  removeAlbum: "Retirer l'album de cet appareil",
  removePlaylist: "Retirer la playlist de cet appareil",
  onDevice: "Sur cet appareil",
  inProgress: "En préparation sur cet appareil",
  progress: "En préparation — {{done}} sur {{total}}",
  waiting: "En attente",
  failed: "N'a pas pu être gardé",
  retry: "Réessayer",
  kept: "Gardé sur cet appareil",
  keptCount_one: "{{count}} titre gardé",
  keptCount_other: "{{count}} titres gardés",
  queued_one: "{{count}} titre part sur cet appareil",
  queued_other: "{{count}} titres partent sur cet appareil",
  refusedSome_one: "{{count}} titre ne peut pas être gardé",
  refusedSome_other: "{{count}} titres ne peuvent pas être gardés",
  noSpace: "Pas assez de place sur cet appareil ({{needed}} nécessaires).",
  failedAll: "Impossible de garder ces titres hors ligne pour l'instant.",
  removed: "Retiré de cet appareil",
  entry: {
    title: "Votre musique sur cet appareil",
    subtitle_one: "{{count}} titre · écouter dans Octave",
    subtitle_other: "{{count}} titres · écouter dans Octave",
  },
  autosync: {
    section: "Hors ligne",
    caption: "Ce qui est gardé sur cet appareil.",
    label: "Tenir à jour les playlists gardées sur cet appareil",
    hint: "Un titre ajouté à une playlist gardée part de lui-même sur l’appareil, un titre retiré le quitte ; la version de la bibliothèque remplace une copie d’ailleurs dès qu’elle existe. Sans réseau, tout se rattrape au retour.",
  },
  player: {
    fromDevice: "Sur cet appareil",
    fromDeviceHint: "Lu depuis la copie gardée sur cet appareil",
  },
  view: {
    title: "Sur cet appareil",
    kicker: "Hors ligne",
    summary: "{{tracks}} · {{size}}",
    collections: "Albums et playlists",
    albums: "Albums",
    playlists: "Playlists",
    tracks: "Titres",
    empty: "Rien sur cet appareil pour l'instant",
    emptyHint: "Gardez un titre, un album ou une playlist hors ligne : ils restent écoutables sans réseau.",
    offlineHint: "Hors ligne : seule la musique gardée sur cet appareil est disponible.",
    removeAll: "Tout retirer",
  },
} as const;
