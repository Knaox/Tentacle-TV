import { resolve } from "node:path";
import { CLIENT, WEB } from "./substitutionPaths";

/**
 * Ce que la cible téléviseur remplace dans le LECTEUR d'`apps/web`, et pourquoi.
 *
 * Extraite de `substitutionTable.ts`, qui la fusionne dans sa table des
 * fichiers : données pures, mêmes règles, même greffon. Le lecteur est la
 * partie la plus longue de la table et la plus sensible — un profil, un flux,
 * une commande —, elle se lit mieux d'un bloc.
 */
export const PLAYBACK_FILES: Record<string, string> = {
  // Le profil d'appareil du téléviseur se compose des mêmes briques que celui
  // du navigateur, mais interroge `deviceInfo` en plus des sondes de codecs.
  // `construireProfil` de `usePlaybackInfo` n'est pas touché.
  [resolve(WEB, "lib/deviceProfile/browser.ts")]: resolve(CLIENT, "playback/profileWebos.ts"),

  // Le pendant du profil, côté lecteur : ce que le démultiplexeur de la dalle
  // n'ouvrira jamais, donc ce qui n'apparaîtra jamais dans `video.audioTracks`.
  // Un navigateur ne sait pas répondre à cette question et dit oui ; une table
  // documentée le sait, et l'appariement des pistes s'en sert pour ne pas
  // donner un rang libre à la mauvaise piste.
  [resolve(WEB, "lib/deviceProfile/playerTracks.ts")]: resolve(CLIENT, "playback/publishableTracksTv.ts"),

  // Le HLS est toujours confié au moteur : la puce de la dalle décode le
  // manifeste, là où le client web a besoin de hls.js.
  [resolve(WEB, "hooks/useNativeHlsPreference.ts")]: resolve(CLIENT, "playback/nativeHlsPreference.ts"),

  // Le manifeste maître d'un remux Dolby Vision propose la variante copiée et
  // deux replis ré-encodés en SDR, tous au MÊME débit annoncé. Le lecteur de
  // webOS 23 ne les départage pas et se trompe une fois sur trois — au prix de
  // la plage dynamique ET d'un ré-encodage 4K. L'enveloppe désigne la variante
  // elle-même ; tout le reste du hook est celui du web.
  [resolve(WEB, "hooks/usePlaybackInfo.ts")]: resolve(CLIENT, "playback/playbackInfoTv.ts"),

  // Les filets de lecture. Ceux du web suffisent à un navigateur, dont le profil
  // d'appareil vient d'une sonde ; celui du téléviseur vient d'une table
  // documentée, et une table finit par se tromper. L'enveloppe ajoute l'échelle
  // de replis de `playbackFallback.ts`, déclenchée par l'erreur média — le seul
  // signal qui dise sans ambiguïté que la puce a refusé le flux.
  [resolve(WEB, "hooks/useWebPlaybackFallbacks.ts")]:
    resolve(CLIENT, "playback/playbackFallbackTv.ts"),

  // La barre de contrôle du web est une rangée de cibles de 44 px, un curseur
  // de volume révélé au survol, du plein écran et de l'incrustation d'image :
  // aucune de ces décisions ne survit à trois mètres. Ce qu'on remplace est du
  // dessin — le seek reste celui de `useSmartSeek`, câblé par les propriétés.
  [resolve(WEB, "components/PlayerControls.tsx")]: resolve(CLIENT, "playback/ControlsTv.tsx"),

  // Le badge de saut, cumulatif. Le dessin du web est repris tel quel — c'est
  // le comptage qui change : on n'appuie pas une fois sur « +30 » à trois
  // mètres, on appuie trois fois, et trois fois « +30 s » laisse l'addition à
  // l'utilisateur.
  [resolve(WEB, "components/SkipBadge.tsx")]: resolve(CLIENT, "playback/BadgeSkipTv.tsx"),

  // La projection de l'ARBITRE (bouton de saut, carte « à suivre », affiche de
  // fin) est ancrée pour un écran d'ordinateur — dans l'overscan — et paraît
  // quand l'habillage est éteint, donc quand le moteur de focus s'est retiré
  // de la route. L'enveloppe la neutralise et la rend elle-même
  // (PlaybackOverlayTv) ; tout le reste des surcouches convient tel quel.
  // Depuis la refonte des segments, c'est la SEULE couture de lecture — la
  // carte et son déclencheur viennent de l'arbitre partagé, plus d'enveloppes
  // séparées (NextCardTv, endCardTv).
  [resolve(WEB, "components/player/VideoPlayerOverlays.tsx")]: resolve(CLIENT, "playback/OverlaysTv.tsx"),

  // Seule prise sur l'enveloppe qui masque les commandes. Le hook du web n'est
  // réarmé que par un mouvement de souris — une télécommande n'en produit pas,
  // et l'habillage s'éteindrait au bout de trois secondes sans jamais revenir.
  [resolve(WEB, "hooks/useControlsAutoHide.ts")]: resolve(CLIENT, "playback/autoHideTv.ts"),

  // Cap automatique de qualité : inerte au navigateur, actif au téléviseur —
  // mesure du débit réel (BitrateTest) et palier imposé quand la connexion ne
  // porte pas le fichier, « Originale » seulement (un choix manuel prime).
  [resolve(WEB, "lib/bitratePolicy.ts")]: resolve(CLIENT, "playback/bitratePolicyTv.ts"),
};
