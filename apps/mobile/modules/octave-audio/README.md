# octave-audio — le moteur audio d'Octave sur le mobile

Le module natif qui joue la musique d'Octave sur iPhone, iPad et Android. Il parle le **même pont** que la
coquille du bureau : `packages/shared/src/octave/engine/audioBridgeContract.ts` (miroir de
`apps/desktop-electron/src/main/audio/audioBridgeContract.ts`). Côté JS, l'adaptateur est PARTAGÉ
(`createBridgeAudioEngine`, même fichier que le bureau) ; ce module n'est que la coquille native.

**Rien ne décide ici** : la file, l'aléatoire, la répétition, le choix de la source, la DURÉE du fondu entre
deux titres (`plannedCrossfadeMs` : jamais dans un album écouté dans l'ordre…) sont décidés en JS. Le natif
EXÉCUTE : il joue le courant, précharge le suivant, enchaîne sans blanc ou fond les deux, et publie ce que le
système affiche.

## Pourquoi un module natif (et pas react-native-track-player, expo-audio, react-native-video)

- L'enchaînement (sans blanc ou en fondu) doit se faire application en arrière-plan, écran verrouillé : sur
  Android, React Native GÈLE ses minuteurs en arrière-plan (cf. CLAUDE.md, « Garder hors ligne ») ; un fondu
  piloté depuis JS s'arrêterait. Le fondu, la fin de titre et la bascule vivent donc dans le natif, comme sur
  le bureau (la coquille exécute, la page décide).
- Les sources de Sillon sont souvent de l'**Opus en WebM** : AVPlayer ne le lit pas. Sur iOS, **mpv**
  (MPVKit, déjà dans l'app pour la vidéo, LGPL) lit tout ce que le bureau lit — le même moteur que le bureau.
  Sur Android, **Media3/ExoPlayer** (Apache-2.0, déjà dans l'app en 1.9.0, décodeurs FFmpeg LGPL pour l'ALAC)
  lit l'Opus/WebM, le FLAC, l'AAC, le MP3, et porte la notification média par `MediaSessionService`.
- Aucune dépendance nouvelle.

## Le pont

JS → natif : `invoke(command, argsJson) → Promise<string>` (réponse JSON, `""` pour rien).
Natif → JS : l'évènement Expo `onBridgeEvent` `{ json }`, où `json` est un `AudioBridgeEvent` sérialisé.

| commande | arguments | réponse | ce que le natif fait |
|----------|-----------|---------|----------------------|
| `audio_engine_start` | `AudioBridgeStart` | `AudioBridgeCapabilities` (`engine: "mpv"` iOS, `"media3"` Android) | ouvre la session audio (catégorie lecture), garde `serverOrigin` et `headers`, applique volume/muet. Idempotent : un second départ réutilise l'instance. |
| `audio_engine_stop` | — | `""` | arrête tout, efface l'écran verrouillé / la notification, rend la session audio. |
| `audio_play` | `{ track: AudioBridgeTrack, source: AudioBridgeSource, startMs }` | `""` | coupe ce qui joue (et tout fondu), oublie le suivant, joue `source.url` à `startMs`. Publie `track.meta`. |
| `audio_set_next` | `{ track \| null, source \| null, crossfadeMs? }` | `""` | le suivant : `crossfadeMs` absent/0 → enchaînement SANS BLANC (préchargé dans la file du lecteur) ; > 0 → fondu de cette durée, démarré à `durée − crossfadeMs`. `null` retire le suivant. |
| `audio_swap_source` | `{ trackKey, source }` | `""` | nouvelle source du courant (relue à la même position) ou du suivant ; émet `swapped`. |
| `audio_control` | `AudioBridgeControl` | `""` | `pause`, `resume`, `stop`, `seek` (ms), `volume` (0–1), `muted`, `replayGain` (mode), `crossfade` (ms, réglage pour info). |
| `audio_list_outputs` | — | `[{ id: "default", name: "", exclusiveCapable: false }]` | |
| `audio_set_output` | — | `""` | sans effet. |
| `audio_level` | — | dBFS (nombre) ou `null` | le niveau RMS du son ENTENDU, pour la vague du lecteur plein écran. Android : `LevelMeter.kt` (`TeeAudioProcessor` de Media3, recalé de 200 ms). iOS : `OctaveOutputMeter.c` — le MPVKit embarqué n'a pas d'`astats` ; la définition d'`AudioOutputUnitStart` dans l'exécutable pose une notification de rendu sur l'AudioUnit de la sortie de mpv, recalée sur `AVAudioSession.outputLatency`. `null` : rien de mesuré (pause, attente). |

Hors du pont : `launchId()` (synchrone) — voir « Fermeture complète ».

### Les sources

- `source.url` est ABSOLUE. Adresse de l'origine `serverOrigin` → requêtes avec `headers` (`X-Emby-Token`).
  `file://…` → fichier local (copie gardée hors ligne, résolue en JS avant l'appel). Toute autre origine est
  refusée (état `error`), sauf un flux direct.
- **Flux direct** (`open: "direct"`, constante `directStreams` du module) : un titre que le TÉLÉPHONE a résolu
  (requêtes déléguées de Sillon) ; l'URL de YouTube ne vaut que depuis sa connexion. La page l'a jugé
  (`src/octave/clientFetch/directSource.ts` : hôte dans les `mediaHosts` déclarés, https, 30 s de vie) ; le natif
  exige https et un `fallbackUrl` du serveur, et l'ouvre SANS `headers` — iOS : `http-header-fields=` pour CE
  fichier (`loadfile`), et un suivant direct ne s'ajoute jamais à la liste de mpv (le préchargement partirait
  avec les en-têtes globaux) : il s'ouvre sur la platine arrière et passe devant net à la fin du courant ;
  Android : l'adresse exacte admise par `SourcePolicy`, résolue sans en-tête. Au premier échec, le natif relit
  `fallbackUrl` (le serveur, `direct=failed`) à la même position, une fois — aussi app en arrière-plan.
  Banc : `audio_debug` → `decks[].bareHeaders` (vrai : aucun en-tête pour le fichier en cours ; jamais la valeur).
- `direct` (la forme du serveur) et `kept` sont ignorés par le natif (le JS a déjà résolu `kept` en `file://`
  et `direct` en `open: "direct"`).
- ReplayGain : `source.replayGain` × mode (`off` : 1 ; `track` : gain du titre ; `album` / `auto` : gain
  d'album s'il existe, sinon du titre), gain linéaire `10^(dB/20)` borné par `1/peak`, multiplié au volume.

### Les évènements

- `state` : `{ status, trackKey, positionMs, durationMs, volume, muted, format: null, output: { deviceId: null,
  exclusive: false }, error, at: Date.now() }` — à chaque changement d'état, et toutes les 250 ms en lecture.
  `trackKey` est celui du titre DEVANT (pendant un fondu : le sortant jusqu'à la mi-fondu, puis l'entrant).
  `status` : `loading` (ouverture), `buffering` (attente de données en lecture), `playing`, `paused`,
  `ended` (fin du dernier titre, rien de suivant), `error` (+ `error` en texte), `idle`.
- `advanced` `{ fromKey, toKey }` : le suivant est devenu le courant — fin de titre sans blanc, ou MI-FONDU.
  Après lui, le natif n'a plus de suivant tant que le JS n'en redonne pas.
- `swapped` `{ trackKey, origin }`.
- `remote` `{ command: "play" | "pause" | "next" | "previous" | "stop" }` : une commande du SYSTÈME (écran verrouillé,
  Centre de contrôle, notification, casque, montre). `stop` : « Arrêter la lecture » de la notification (Android)
  ou l'application balayée — le son est déjà coupé, le JS vide sa file (`OctavePlayer.clear`). `play` / `pause` : le natif les applique AUSSI tout de
  suite (réactivité), puis les transmet (le JS tient l'intention « lecture »). `next` / `previous` :
  transmises seulement (la file est en JS). La position (barre de l'écran verrouillé) : appliquée par le
  natif, état `state` ensuite.

### Interruptions

- Appel, alarme, autre application qui prend le son : pause native + `remote: pause` ; à la fin, si le
  système dit « reprendre » ET qu'on jouait, lecture + `remote: play`.
- Sortie débranchée (casque filaire, Bluetooth coupé) : pause native immédiate + `remote: pause`.
- Android : « baisser le son » (canard) → volume × 0,2 le temps de l'interruption.

### Fondu (transition douce)

Deux lecteurs (« platines »). Au signal (`durée − crossfadeMs` atteint sur la platine devant), la platine du
suivant (déjà ouverte, en pause à 0) démarre ; les gains suivent des courbes à PUISSANCE CONSTANTE —
`sortant = cos(x·π/2)`, `entrant = sin(x·π/2)`, `x` = temps de LECTURE écoulé / durée (une pause suspend le
fondu, les deux platines en pause). À mi-fondu : `advanced`, l'entrant passe devant (état, écran verrouillé).
À la fin : le sortant est GARÉ (iOS : un silence en mémoire, en pause — jamais `stop`, voir « Système »). Un geste (Suivant, un titre choisi → `audio_play`) coupe tout fondu net.

### Système

- iOS : `AVAudioSession` catégorie `.playback` (mode par défaut), JAMAIS mixable — une app mixable n'est jamais
  « À l'écoute » ; mpv pose `MixWithOthers` à chaque ouverture de sa sortie sans `audio-exclusive=yes` (posé sur
  les platines). Activée quand le son part ou REPREND (pas au démarrage du moteur : ouvrir Octave ne coupe pas
  la musique d'une autre app) ; mpv la rend en fermant une sortie. `UIBackgroundModes: audio` (déjà posé),
  `MPNowPlayingInfoCenter` (titre, artiste, album, pochette, durée, position, vitesse) et
  `MPRemoteCommandCenter` (lecture, pause, bascule, suivant, précédent, position). Les commandes sont
  ÉTEINTES à l'arrêt du moteur.
- iOS, les deux platines : chaque fermeture d'une sortie mpv DÉSACTIVE la session (`ao_audiounit`, `setActive:NO`) —
  et depuis iOS 8 la session est désactivée même si l'autre platine joue (AVAudioSession.h) : son, puis l'app
  derrière, s'arrêtaient (« pauses » sur « Lire ensuite », en quittant l'app ; accroc au préchargement du suivant,
  qui rouvrait la sortie de la platine arrière). Donc : sortie au format FIXE (48 kHz, stéréo, flottant : mpv
  rééchantillonne, la sortie n'est jamais rouverte d'un titre à l'autre) et une platine libérée est GARÉE (`park` :
  20 ms de silence `hex://`, en pause), jamais arrêtée ; `stop` seulement quand plus rien ne doit sonner. Les deux
  instances mpv survivent à `audio_engine_stop` (retour dans Octave sans rien recréer).
- Android : `MediaSessionService` Media3 (`OctaveAudioService`, `foregroundServiceType="mediaPlayback"`),
  notification média par défaut de Media3 (pochette, titre, artiste, lecture/pause, précédent/suivant,
  barre). La session suit la platine DEVANT ; les commandes précédent/suivant sont toujours proposées.
  Un bouton « Arrêter la lecture » (commande de session `StopCommand`) : son coupé, service et notification
  arrêtés, `remote: stop`.

### Fermeture complète (règle du 29/10)

L'application fermée pour de bon ARRÊTE la musique, et au relancement rien n'est repris ; l'arrière-plan et
l'écran verrouillé, eux, continuent de jouer.

- La fonction SYNCHRONE `launchId()` rend le lancement en cours : la reprise du lecteur (`attachPlayerResume`,
  api-client) ne reprend qu'une session gardée par CE lancement. iOS : un identifiant par processus (iOS tue
  l'app balayée). Android : le processus, puis +1 à chaque balayage — le processus (et le JS) peut survivre au
  balayage tant qu'un service tourne (transferts hors ligne).
- Android : `OctaveAudioService.onTaskRemoved` arrête tout (platines, focus, service, notification), même en
  pleine écoute, change le lancement et émet `remote: stop`. Les transferts hors ligne ont leur propre service :
  ils continuent.
- iOS : `UIApplication.willTerminateNotification` (une app qui joue en fond est prévenue avant d'être tuée) :
  son coupé, commandes éteintes, écran verrouillé vidé tout de suite — sinon son « Lecture » relançait l'app.
