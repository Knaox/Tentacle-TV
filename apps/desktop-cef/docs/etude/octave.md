# Étude — Octave (mode musique) sur le bureau, et ce qu'en fait le proto CEF

Session **octave** du lot « proto CEF », 03/11/2026. Lu en lecture seule : Tentacle-TV `7434d90fc`
(desktop v1.42.0), référence `andrewrabert/jellium-desktop` ère C++ (`3462549`) et `main` (`1b73a13`).
Chaque affirmation renvoie au fichier lu ; ce qui ne l'a pas été est marqué **non vérifié**.

## 1. En une page

| Question | Tentacle (Electron) | Référence (jellium C++) | Proto CEF (choix) |
|---|---|---|---|
| Qui joue le son ? | **mpv**, dans le processus principal, instance À PART de la vidéo | mpv, la MÊME instance que la vidéo | mpv, instance À PART (comme Tentacle) |
| Repli | `<audio>` HTML si la commande `audio_play` n'est pas déclarée | — (le lecteur HTML de jellyfin-web) | aucun : CEF officiel sans AAC/MP3 propriétaire → mpv obligatoire |
| Surface / fenêtre | aucune : `vo=null`, `vid=no`, `audio-display=no` | la couche vidéo rendue visible à chaque `load`, même musique | aucune : `Player` jamais attaché à une `VideoSurface`, `vid=no` |
| Canaux | `audio_*` (9 commandes) + évènement `audio://event` | `window.api.player.load(…, {type:'music'})` | les mêmes `audio_*` que Tentacle, mêmes formes |
| File d'attente | dans la PAGE (`OctavePlayer`) ; la coquille ne tient que COURANT + SUIVANT | jellyfin-web (playbackManager) | idem Tentacle : courant + suivant dans la playlist mpv |
| Enchaînement | `audio_set_next` → ajouté à la playlist mpv, `prefetch-playlist`, `gapless-audio=weak` → évènement `advanced` | `loadfile replace` par titre (un blanc) | idem Tentacle (sans blanc) |
| Bascule musique → vidéo | modes EXCLUSIFS : quitter Octave démonte le moteur (`audio_engine_stop`, instance détruite) ; la session revient en PAUSE au retour | une instance : le `loadfile` de la vidéo remplace la musique | idem Tentacle + un arbitre natif défensif (la vidéo qui démarre met la musique en pause) |
| Now Playing / touches média | **rien pour la musique au bureau** (`systemMeta` réservé au mobile ; `smtc_*` = touches via `globalShortcut`, monté par le lecteur VIDÉO seulement) | `MPNowPlayingInfoCenter` + `MPRemoteCommandCenter` (macOS) | non fait au jalon O1 (écart assumé = parité Tentacle) ; piste notée § 6 |

## 2. Tentacle : comment Octave joue sur le bureau

### 2.1 Les deux étages
- **Contrôleur** `OctavePlayer` (`packages/shared/src/octave/octavePlayer.ts`) : file, instantané, position.
  Il ne parle qu'à un port `AudioEnginePort` (`packages/shared/src/music/musicPlayback.ts`).
- **Moteur** : choisi par `apps/web/src/music/engine/createAudioEngine.ts` :
  `supportsNativeAudio()` ⇔ `window.tentacle.capabilities` contient `"audio_play"`
  (`apps/web/src/desktop/capabilities.ts`) **et** `desktopKind()==="electron"`, c.-à-d.
  `typeof window.tentacle === "object"` au chargement (`desktop/detect.ts`). Sinon `<audio>`.
  - POURQUOI mpv au bureau : bit-perfect, sortie exclusive, gapless sans blanc, ReplayGain,
    formats que Chromium ne lit pas (et pour nous : **CEF officiel n'a ni AAC ni MP3 ni H.264**).
- Le port natif est `createBridgeAudioEngine` (`packages/shared/src/octave/engine/bridgeAudioEngine.ts`),
  PARTAGÉ avec le mobile. Il « met la barre à jour AVANT le son » (état `loading` posé localement
  puis commande), et **extrapole** la position entre deux états à partir de `at`.

### 2.2 Le contrat (`apps/desktop-electron/src/main/audio/audioBridgeContract.ts`, miroir de `packages/shared/…`)
Commandes (`window.tentacle.invoke(nom, args)`), toutes déclarées dans `capabilities` :

| Commande | Arguments | Réponse |
|---|---|---|
| `audio_engine_start` | `{serverOrigin, headers, volume, muted, replayGain, deviceId, exclusive}` | `{engine:"mpv", gapless, exclusiveOutput, replayGain, codecs[], hotSwap}` |
| `audio_engine_stop` | `{}` | — (instance détruite) |
| `audio_play` | `{track:{trackKey, albumKey, durationMs, format}, source:{url, origin, complete, sizeBytes, durationMs, replayGain, expiresAt, direct?, kept?}, startMs}` | — |
| `audio_set_next` | `{track|null, source|null, crossfadeMs?}` | — |
| `audio_swap_source` | `{trackKey, source}` | — |
| `audio_control` | `{action: pause|resume|stop|seek(value ms)|volume(0..1)|muted|replayGain(mode)|crossfade(ms)}` | — |
| `audio_list_outputs` / `audio_set_output` | — / `{deviceId, exclusive}` | `[{id,name,exclusiveCapable}]` |
| `audio_level` | `{}` | dBFS ou `null` |

Évènement unique `audio://event` (`window.tentacle.on`) : `state` (`{status, trackKey, positionMs,
durationMs, volume, muted, format, output, error}`, `at`), `advanced {fromKey,toKey}`,
`needSource {trackKey}`, `swapped`, `remote {command}`.
- `status` ∈ `idle|loading|playing|paused|buffering|ended|error` (`audioEngineState.ts › deriveStatus`) :
  `loading` seulement entre un chargement et `playback-restart` (au passage gapless `time-pos` disparaît
  un instant sans que rien ne s'arrête : pas de `loading`) ; `ended` = fin du DERNIER titre.
- L'état part **au plus 4 fois/s** pour la position, tout de suite pour le reste (`STATE_INTERVAL_MS=250`).
- Garde de sécurité : une source n'est confiée à mpv que si son origine est le serveur Tentacle réglé au
  démarrage (`audioSources.ts › refuseSource`) ; l'authentification part en `http-header-fields`.

### 2.3 L'instance mpv de la musique (`audioMpv.ts`, `audioOptions.ts`)
- **Une instance À PART** sur la même libmpv. POURQUOI (commentaire de `audioMpv.ts`) : le module vidéo
  est un singleton pensé pour UNE lecture ; une seconde lecture y mêlait ses réponses et l'arrêt de l'un
  réglait les commandes de l'autre. Ici tout l'état vit dans l'objet.
- Options : `vo=null, vid=no, video=no, audio-display=no` (une pochette embarquée ne devient jamais une
  vidéo), `idle=yes`, **`keep-open=yes`** (le dernier titre s'arrête en pause sur sa fin : le moteur a le
  temps de dire « fini »), **`gapless-audio=weak`** (jamais `yes` : `yes` rééchantillonne au format du
  premier titre), `prefetch-playlist=yes`, cache audio léger (`demuxer-max-bytes=48MiB`),
  `cache-pause-initial=no`, `volume-max=100` (jamais d'amplification), `input-default-bindings=no`.
- Tout est **asynchrone** (`mpv_command_async`, `mpv_get_property_async`, `mpv_wait_event(0)` par une
  pompe 20 ms en lecture / 250 ms au repos). Arrêt : `quit` async puis `mpv_destroy` à `SHUTDOWN`
  (mesuré : `mpv_terminate_destroy` bloquait jusqu'à 1,5 s le fil principal).
- La liste mpv a toujours la forme `[en cours, (bascule), (suivant)]` (`audioQueue.ts`) ; les identifiants
  d'entrée mpv sont PRÉVUS (seul le moteur ajoute à son cœur) et `START_FILE` dit quelle entrée part :
  `advance` → évènement `advanced`.
- Propriétés observées : `time-pos, eof-reached, paused-for-cache, audio-codec-name, file-format,
  audio-params/samplerate, audio-params/channel-count, audio-bitrate, duration, demuxer-cache-time`.
- Le fondu enchaîné (`crossfadeDecks.ts`) tient DEUX instances ; coupé (0 ms, le défaut), une seule.

### 2.4 Préchauffage
- `enginePrestart.ts` : la bascule vers Octave démarre le moteur **au geste** (pointeur enfoncé), ~100 ms
  d'avance ; s'il n'est pas adopté dans 4 s, il s'arrête. Interdit : un moteur qui tourne sans Octave affiché.
- `outputWarmup.ts` : la sortie audio est ouverte à la naissance de l'instance (premier son plus vite).

### 2.5 Mini-lecteur, file, pause/seek
Tout est dans la page (`apps/web/src/music/octave/…`, `OctavePlayerProvider.tsx`) : la coquille ne voit
que `audio_play`, `audio_set_next` (le suivant de la file, renvoyé à chaque changement), `audio_control`.
« Précédent » = un nouvel `audio_play` (ou `seek 0` si la position > quelques secondes — **non vérifié**
dans le détail, c'est le contrôleur partagé qui décide).

### 2.6 La bascule musique ↔ vidéo
- Octave est une **application à part** (`/octave/*`, `OctaveApp.tsx`), montée/démontée avec le mode ; son
  `OctavePlayerProvider` porte le moteur : « la musique s'arrête en sortant d'Octave ». Quitter Octave ⇒
  `dispose()` ⇒ `audio_engine_stop` ⇒ instance mpv détruite (sortie audio libérée).
- La session quittée est gardée (`attachPlayerResume`) : au retour, **dernier titre, file et position en
  PAUSE**. On ne lance donc jamais de vidéo pendant que la musique joue *dans l'interface* : les deux
  lecteurs ne se croisent pas. Le lecteur vidéo garde son instance (`mpv_init`, `video/mpv.ts`).
- Seul garde-fou de concurrence : `ownsNative()` (le dernier `audio_engine_start` possède l'instance).

### 2.7 Ce que lit la musique
- Bibliothèque Jellyfin, via le serveur Tentacle : capacité `music.library` (servie par le **backend
  Tentacle lui-même**, `apps/backend/src/music/routes/musicRoutes.ts`), source
  `/api/music/stream/:id` relayée depuis `/Audio/{id}/stream?static=true` de Jellyfin (jamais transcodé,
  `media/streamRelay.ts`), pochettes `/api/music/artwork/:id`. ⇒ **marche sur un banc Jellyfin seul**.
- Extension Sillon (`origin:"plugin"`, flux directs googlevideo par relais local, radio, import) : **hors
  banc**, non reprise (pas de `direct`, pas de `needSource` utile).
- Hors ligne (`kept`) : non repris (pas de base de transferts dans le proto).

## 3. Référence (jellium-desktop)

- **Ère C++ (≤ `3462549`)** : `src/web/mpv-audio-player.js` (plugin jellyfin-web `mpvaudioplayer`) appelle
  `window.api.player.load(url, {startMilliseconds, autoplay}, {type:'music', metadata}, -1, -1)` ; la MÊME
  instance mpv (`src/player/mpv/mpv_player.cpp` : `vo=libmpv`, `keep-open=yes`,
  `audio-fallback-to-null=yes`) que la vidéo. `main.cpp` (`playerLoad`, l. ~2030) met `has_video=true` et
  `videoRenderer.setVisible(true)` **quel que soit le type** ; `Finished/Canceled/Error` le cachent.
  ⇒ chez elle, la couche vidéo existe en permanence (créée au démarrage) et n'est que montrée/cachée.
  La bascule audio → vidéo = un `loadfile replace` : la vidéo coupe la musique.
- Now Playing macOS : `src/player/macos/media_session_macos.mm` (`MPNowPlayingInfoCenter`,
  `MPRemoteCommandCenter`), sur un fil à part (`media_session_thread`).
- **Leçon tardive** (`c5ad000`, 06/05/2026, ère Rust) : « mpv: disable video track for audio playback » —
  avec `vid=1`, un MP3/FLAC à **pochette embarquée** expose un flux « image » ; mpv le traite en vidéo
  creuse, passe en `STATUS_DRAINING` après l'unique image et **termine le fichier au bout d'~1 s** : chaque
  titre d'album sautait. ⇒ notre musique de test porte des pochettes embarquées, et on prouve `vid=no`.
- Pas de file native ni de gapless : un `load` par titre.

## 4. Choix du proto, et pourquoi

1. **Contrat `audio_*` de Tentacle, tel quel** : le front de Tentacle n'a rien à changer ; il suffit que
   `window.tentacle.capabilities` contienne `audio_play` et que les commandes répondent aux mêmes formes.
2. **Instance mpv à part, jamais de surface** (`Player` de vidéo-HDR créé en audio seul, ou libmpv
   direct tant que l'API `Player` n'est pas livrée) : zéro couche Metal pendant la musique ⇒ aucun risque
   de couche sRGB « née plate » qui volerait l'EDR à la vidéo (fait mesuré n° 1 du brief) ; la vidéo fait
   naître SA couche à son premier `loadfile`. La référence (une instance, couche permanente) est
   justement le modèle que le brief nous dit d'éviter pour l'EDR.
3. **File = courant + suivant dans la playlist mpv** (`gapless-audio=weak`, `prefetch-playlist`) :
   enchaînement sans blanc décidé natif, sans aller-retour IPC.
4. **Bascule** : la page de Tentacle arrête le moteur en quittant Octave (rien à faire) ; en plus un
   **arbitre natif** : si une lecture vidéo démarre alors que la musique joue (cas hors Tentacle, ou
   course), la musique est mise en PAUSE (pas détruite) et l'état part vers la page. Au retour, rien à
   détacher côté musique : elle n'a jamais eu de surface ; c'est la vidéo qui détache la sienne.
5. **Son coupé** (règle du lot) : l'instance naît `mute=yes` et le reste quoi que demande la page
   (`muted:false`) ; l'état renvoyé à la page reflète la DEMANDE de la page (l'interface reste juste).
   Bidouille de banc, listée au rapport.
6. **Non repris** : fondu enchaîné (2 instances), sortie exclusive, bascule à chaud, relais direct,
   hors ligne, `audio_level` (rend `null`), Now Playing (parité Tentacle).

## 5. Pièges à ne pas redécouvrir
- `vid=no` + `audio-display=no` (pochettes embarquées : fin à ~1 s sinon — référence `c5ad000`).
- `gapless-audio=weak`, pas `yes`. `keep-open=yes` pour voir la fin du dernier titre.
- Jamais d'appel mpv synchrone depuis un rappel d'évènement mpv (deadlock — `AGENTS.md` de la référence).
- Arrêt par `quit` asynchrone, puis destruction à `MPV_EVENT_SHUTDOWN`.
- `loadfile replace` lève la pause de `keep-open` : reposer `pause` selon la VOLONTÉ.

## 6. Ouvert
- Now Playing / touches média macOS (`MPRemoteCommandCenter` → évènement `remote`, que la page sait déjà
  traiter) : faisable en ~150 lignes `.mm`, hors parité Tentacle bureau.
- Fondu enchaîné : 2e instance — non repris.
