export default {
  pressToPlay: "Tap to play",
  skipIntro: "Skip intro",
  skipCredits: "Skip credits",
  settings: "Settings",
  audio: "Audio",
  subtitles: "Subtitles",
  subtitlesDisabled: "Disabled",
  applyToSeries: "Apply to this series",
  appliedToSeries: "Languages saved for this series",
  applyToSeriesFailed: "Could not save languages for this series",
  seriesPreferenceCleared: "Series language preference removed",
  disabled: "Disabled",
  quality: "Quality",
  speed: "Playback speed",
  original: "Original",
  quality1080pHigh: "1080p High",
  quality1080p: "1080p",
  quality720p: "720p",
  quality540p: "540p",
  quality360p: "360p",
  previousEpisode: "Previous episode (P)",
  nextEpisode: "Next episode (N)",
  skipBack: "-10s",
  skipForward: "+30s",
  nextEpisodeIn: "Next episode in",
  playNow: "Play now",
  playNowIn: "Play now in {{seconds}}s",
  tracks: "Tracks",
  tracksAudioSubtitle: "Audio and subtitle tracks",
  audioLabel: "AUDIO",
  subtitlesLabel: "SUBTITLES",
  trackFallback: "Track {{index}}",
  mpvError: "mpv error: {{error}}",
  fallbackPlayerTitle: "Backup player",
  fallbackPlayerHint:
    "The built-in player could not start; playback continues with the web player. HDR and HEVC may be limited.",
  secondsShort: "sec",
  nextEpisodeLabel: "Next episode",
  scrubConfirmHint: "OK · Play here",
  scrubCancelHint: "Back · Cancel",
  // Le décompte du défilement (TV) : ce qui se passera si l'on ne bouge plus
  // (entré en lecture, toutes entrées) — lire à la position visée, ou
  // revenir où l'on était (réglage « Avance rapide », Apple TV) — et, dessous,
  // le geste de l'autre choix.
  scrubPlayIn: "Playing in {{seconds}}s",
  scrubReturnToIn: "Back to {{time}} in {{seconds}}s",
  scrubOtherPlayHere: "OK: play here",
  scrubOtherGoBack: "Back: return to {{time}}",
  nowPlaying: "Now playing",
  loadFailed: "Playback could not start. Check the server or try again.",
  streamStartFailed: "The video stream did not start. Retry or change quality.",
  mediaMissingTitle: "File not found",
  mediaMissingHint:
    "The downloaded file is no longer on disk. Retry will restart playback — streaming if the server is reachable.",
  upNext: "Up Next",
  autoplayCountdown: "Next episode in {{seconds}}s",
  skipIntroIn: "Skip intro in {{seconds}}s",
  dismiss: "Dismiss",
  // L'affiche de fin : la refuser SORT du lecteur — le bouton dit où l'on va.
  backToDetails: "Back to details",
  rateJustWatched: "Rate the episode you just watched",
  // Les segments au-delà de l'intro — chaque libellé a sa forme décomptée.
  skipRecap: "Skip recap",
  skipRecapIn: "Skip recap in {{seconds}}s",
  skipPreview: "Skip preview",
  skipPreviewIn: "Skip preview in {{seconds}}s",
  skipCreditsIn: "Skip credits in {{seconds}}s",
  skipToPostCredits: "Skip to post-credits scene",
  skipToPostCreditsIn: "Post-credits scene in {{seconds}}s",
  // Film ou dernier épisode : il n'y a rien à passer, le générique va au bout.
  // Le bouton dit donc ce qu'il fait — et reste manuel, jamais décompté.
  endPlayback: "End playback",
  endPlaybackIn: "End playback in {{seconds}}s",
  // La pilule qui prend le relais de la fiche « à suivre » — pendant une
  // scène post-générique, ou quand la fiche est éteinte ou refusée.
  goToNextEpisode: "Go to next episode",
  playbackError: "Video playback error",
  playbackGiveUp: "This video can't be played on this TV",
  qualityReduced: "Quality lowered to match your network speed",
  qualityReducedDetail: "Quality lowered: network measured at {{measured}} Mb/s, the file needs {{source}} Mb/s",
  qualityAutoBadge: "Auto",
  // POURQUOI la qualité baisse en Auto (`player/qualityDrop.ts`) : le message
  // éphémère, puis sa ligne relisible dans le menu Qualité, sous « Auto ».
  qualityDropTitle: "Quality lowered",
  qualityDropDismissed: "Hidden. The reason is still shown in the Quality menu.",
  qualityDrop: {
    network: "The measured network ({{measured}} Mb/s) can't carry this file ({{source}} Mb/s): quality adapts.",
    remoteLimit: "Jellyfin limits connections over the Internet to {{limit}} Mb/s: this server setting lowers the quality.",
    server_videoFormat: "The server converts the video, which this device can't play as is: the picture loses a little detail.",
    server_hdr: "The server converts the HDR video for this screen: the picture loses a little detail.",
    server_subtitles: "The server burns the subtitles into the picture: it loses a little detail.",
  },
  qualityDropMenu: {
    network: "Network measured at {{measured}} Mb/s, the file needs {{source}}",
    remoteLimit: "Jellyfin Internet limit: {{limit}} Mb/s",
    server_videoFormat: "Video converted by the server for this device",
    server_hdr: "HDR video converted by the server for this screen",
    server_subtitles: "Subtitles burned in by the server",
  },
  directSessionExpired: "Jellyfin session expired — confirm pairing again from a signed-in device",
  // Le motif technique d'une erreur de lecture, replié.
  details: "Details",
  retry: "Retry",
  back: "Back",
  airplayActive: "Playing on external display",
  episodes: "Episodes",
  noEpisodes: "No episodes",
  close: "Close",
  loading: "Loading…",
  loadingMedia: "Loading {{title}}…",
  // Appelees avec un defaut litteral anglais par `PlayerControls` du web ;
  // la rangee de transport du televiseur, elle, les lit sans repli.
  play: "Play",
  pause: "Pause",
  // Le bouton qui ENTRE en mode deplacement. `scrubConfirmHint` et
  // `scrubCancelHint` sont des indices affiches PENDANT ; celle-ci nomme
  // l'action, et n'a d'emploi que la ou se deplacer est un mode — la
  // telecommande.
  seekMode: "Seek",
  // tvOS loading screen: what PrismCore is doing while opening the file.
  prismOpening: "Opening the file…",
  prismResolving: "Reading the tracks…",
  prismIndexing: "Indexing (first play)…",
  prismPreparing: "Preparing…",
  prismStarting: "Starting playback…",
  // Refonte de l'habillage TV : ce qui s'écrivait en dur (« -10s », « +30s »,
  // « E01 »).
  seekBackBy: "Back {{seconds}}s",
  seekForwardBy: "Forward {{seconds}}s",
  seekFlashBack: "−{{seconds}}s",
  seekFlashForward: "+{{seconds}}s",
  previousEpisodeLabel: "Previous episode",
  episodeNumber: "Episode {{number}}",
  // The player's trouble tool, when a server stops answering: what is
  // happening, what still works, what will happen, and the useful gestures.
  troubleMediaTitle: "Jellyfin isn't responding",
  troubleTentacleTitle: "The Tentacle server isn't responding",
  troubleNetworkTitle: "The connection to the server was lost",
  // « Trop lent » ne vise que le réseau MESURÉ sous le besoin du flux (tv-core
  // `networkShortfall`) : un serveur qui transcode lentement n'est pas une
  // connexion lente.
  troubleSlowTitle: "The connection is too slow",
  troublePlayingOn: "Playback continues: {{time}} still loaded.",
  troublePlayingUnaffected: "Playback doesn't depend on it: it continues.",
  troubleResumesAt: "Playback will resume on its own at {{position}}, without losing anything, as soon as the server answers.",
  troubleSlowDetail: "Network measured at {{measured}} Mb/s: this quality needs {{needed}} Mb/s. A lower quality asks less of the network.",
  troubleStuckDetail: "The server answers, but playback won't restart at {{position}}.",
  troubleCheckingIn: "Checking again in {{seconds}}s",
  troubleChecking: "Checking the server…",
  troubleStillDown: "Still unreachable — checking again in {{seconds}}s",
  troubleResuming: "Resuming playback…",
  troubleBackTitle: "The server is answering again",
  troubleResumingAt: "Playback resumes at {{position}}.",
  troubleSlowWaiting: "Playback resumes as soon as enough video has loaded",
  troubleStuckStatus: "Automatic retries weren't enough",
  troubleRetryNow: "Try again now",
  troubleLowerQuality: "Lower the quality",
  troubleResumed: "Playback resumed",
  troubleResumedDetail: "The server is answering again.",
  troubleSeconds: "{{count}}s",
  troubleMinutes: "{{count}} min",
  troubleStartMedia: "Jellyfin isn't responding. Playback will start on its own as soon as it's back.",
  troubleStartTentacle: "The Tentacle server isn't responding. Playback will start on its own as soon as it's back.",
  troubleServerTakesOver: "Playback now goes through the server",
  troubleServerTakesOverDetail: "Direct playback kept stalling here: the server is now converting the video.",
  audioOutputLostPlay: "The audio output isn't responding. Check the TV or receiver, then press Play.",
  // Un arrêt sans coupable connu (lecture directe), et un transcodage qui
  // n'avance plus depuis deux minutes.
  troubleStallTitle: "The video is taking a while",
  troubleStallDetail: "The server answers, but the video has stopped arriving.",
  troubleStallWaiting: "Trying again automatically in a moment",
  troubleTranscodeTitle: "Transcoding has stopped moving",
  troubleTranscodeDetail: "The server answers, but no picture has arrived for two minutes.",
  troubleTranscodeStatus: "Try again restarts the transcoding, at the same spot",
  // La ligne discrète d'un transcodage lent (ouverture, changement de qualité,
  // arrêt en lecture) : rien n'est bloqué, le chargement continue.
  transcodeSlowHint: "Transcoding may take a little longer",
  // Après un saut pendant un transcodage (`player/transcodeSeek.ts`) : la
  // phrase sous l'indicateur, quand l'attente dépasse 5 s.
  seekPreparing: "The server is preparing the video at this point…",
  networkSlowHint: "The connection is too slow for this quality",
  // L'onglet « Réglages » du lecteur Apple TV : la qualité, et tout ce qui
  // n'est pas un choix de piste (« Pistes » ne garde qu'audio et sous-titres).
  playbackSettings: "Settings",
  qualityGuideTitle: "How to choose",
  qualityGuideOriginal: "“Original” plays the file as is, with no conversion: the best picture, if the network keeps up.",
  qualityGuideConverted: "The other qualities are converted by the server: lighter on the network, they can take a little longer to start.",
  // Jellyfin outage during playback (`player/jellyfinOutageCopy.ts`): one
  // title per state, told by the Tentacle server — never a playback error.
  jellyfinOutage: {
    restarting: "Jellyfin is restarting",
    shuttingDown: "Jellyfin is shutting down",
    down: "Jellyfin is stopped",
    starting: "Jellyfin is restarting — almost ready",
    hint: "Playback will resume on its own, right where it left off.",
    longTitle: "Jellyfin still isn't responding",
    longHint: "Your position is saved: playback will resume as soon as it's back.",
    retry: "Try again",
  },
  // Le PiP du bureau (Linux, `apps/web/src/pictureInPicture/`) : réduire la
  // lecture dans une petite fenêtre et continuer dans l'application.
  pip: {
    reduce: "Minimize video",
    expand: "Back to the player",
    close: "Close video",
    dock: "Dock in the app",
    undock: "Detach to the desktop",
    play: "Play",
    pause: "Pause",
    back10: "Back 10 seconds",
    forward30: "Forward 30 seconds",
  },
  // Ce que l'appareil ne décode pas et que le serveur convertit, dit une fois,
  // discrètement, à l'ouverture (`devicePlaybackVerdict`, Android TV).
  deviceNotice: {
    av1Converted: "This device can't play AV1: the server converts it",
  },
} as const;
