# Banc du moteur audio (Octave)

Le moteur natif de la musique (`src/main/audio/`, mpv en audio seul) mesuré sur
la VRAIE libmpv livrée (LGPL 0.40), sous Node — sans Electron, sans fenêtre,
rien qui vole le focus. Jamais lancé par `pnpm test`.

```bash
TENTACLE_MPV_LIB=livree pnpm --filter @tentacle-tv/desktop-electron bench:audio [scénarios…]
```

`BENCH_DIR` : dossier des fichiers témoins (générés par `fixtures.mjs`, ffmpeg du
PATH). Serveur du banc : port 3102 (`serve.mjs` joue le serveur Tentacle :
`Range`, en-tête `X-Emby-Token: bench` exigé, fichier qui grandit).
`tsx` : celui du dépôt (hoisté, devDependency du backend).

## Ce qui est mesuré, et comment

| Scénario | Sortie | Mesure |
|---|---|---|
| `gapless`, `swapCurrent`, `swapNext`, `provisionalEnd`, `growingFast`, `growingSlow`, `writerStall` | PCM dans un fichier | comparée à la référence À L'ÉCHANTILLON (`pcmCompare.mjs` : aucun évènement = bit pour bit) |
| `gaplessRealtime`, `swapRealtime`, `heldRealtime` | CoreAudio, −78 dB | blanc au raccord = temps écoulé − position gagnée (`audio-pts`, relevé toutes les 2 ms) |
| `latency` | CoreAudio, −78 dB | clic → premier échantillon ENTENDU : `t − audio-pts` (mpv y retranche la latence déclarée par CoreAudio) |
| `ram`, `exclusive`, `outputs` | CoreAudio | RSS du processus ; `current-ao` (`coreaudio_exclusive` = hog mode) |

⚠️ La sortie PCM n'est pas cadencée : elle prouve la CONTINUITÉ des échantillons,
jamais leur horaire (un blanc dû à un rechargement n'y laisse aucune trace). D'où
les scénarios temps réel.

Le témoin : deux glissandos et un bruit déterministe (−26 dB) — sans le bruit, le
signal est presque périodique et une corrélation hésite d'une période à l'autre.
Il pèse ~140 ko/s en FLAC : les débits du banc sont des multiples de ce temps réel.

Sur le Jellyfin du banc Octave (agent 3, `bench/octave/up.sh`, port 8196) — de vrais fichiers servis par
Jellyfin, à demander explicitement : `jfGaplessPcm` (l'album « Enchaînement continu » comparé à l'échantillon au
décodage ffmpeg de ses fichiers), `jfGaplessRealtime`, `jfLatency`, `jfFormats`, `jfReplayGain`. État du banc :
`OCTAVE_BENCH_ENV` (défaut : `.claude/octave/bench-state/jellyfin.env`), fichiers : `OCTAVE_BENCH_MUSIC`.

## Les autres bancs

- `electronSmoke.mjs` : le pont dans le VRAI Electron (preload, zod, garde des
  sources, évènements). Verrou du lot, profil jetable, fenêtre jamais active, CDP
  9232. `pnpm --filter @tentacle-tv/desktop-electron build:ts` d'abord.
- `apps/web/bench/audio-engine/` : le moteur `<audio>` dans Chrome sans tête (CDP
  9232), ce que SORTENT les éléments enregistré par un AudioWorklet.

- `firstSound.mts` (lot Sillon vitesse, S5) : clic sur un titre HORS bibliothèque jamais joué →
  premier son, une fois l'URL connue. Le vrai moteur devant un relais `/api/plugins/sillon/*` et le
  banc de Sillon (`bench/playback/firstSoundHost.ts` du dépôt Sillon : vraies routes de lecture, faux
  googlevideo mesuré ou vraies URL). Port 3305 ; `FS_MPV` pour éprouver des options. Pendant web :
  `apps/web/bench/audio-engine/firstSound.mjs` (Chrome sans tête, CDP 9335).

## Ce que le banc a appris (à ne pas redécouvrir)

- Bascule à chaud : jamais `start=T` sur l'entrée suivante — c'est un SAUT, qui
  vide la sortie (échantillons continus, 230 à 310 ms de trou en temps réel). Une
  EDL qui commence à T (`edl://…,start=T,length=…`) : 0 ms. Sans `length`, mpv
  perd le dernier échantillon du titre.
- `end` et `start` pile sur une frontière d'échantillon : un échantillon répété.
  Au milieu de deux échantillons : bit pour bit.
- `end` doit tomber au-delà du tampon de sortie (0,2 s CoreAudio, ~1,5 s PCM).
- `keep-open` met mpv en pause sur la fin du dernier fichier : tout fichier
  suivant (chargé ou ajouté) en hérite.
- Fichier qui grandit : flux tenu, ou `Content-Range: bytes a-b/<taille finale>`.
  `bytes a-b/*` casse l'analyse de ffmpeg lui-même. Jamais `reconnect_at_eof` :
  ffmpeg boucle alors sur la vraie fin (reprise à 33 s au lieu de 9).
- ffmpeg lit ~124 ko d'un FLAC avant de l'ouvrir : la latence d'un fichier en
  écriture suit la vitesse d'écriture.
- Le palier de ~2 s du premier clic : le PREMIER `AudioUnitInitialize` d'un
  processus fait recenser à macOS les composants audio (1,5 à 1,9 s mesurés à
  froid, 17 ms cache chaud ; une fois par processus — 3 ms après 60 s de silence
  dans le même processus). Remède : `outputWarmup.ts` (50 ms de silence numérique
  à la naissance de l'instance). Mesure : `jfFirstClick` (un processus par
  mesure, `CLICK_WARM=0` pour l'avant), `jfClicks` (20 clics enchaînés).
- Titre hors bibliothèque (webm Opus 251 de YouTube, Cues en tête) : mpv ne lit que ~8–15 ko avant le
  premier son, ~7 ms après le premier octet ; le m4a AAC 140 ~10–15 ko et ~30 ms de plus (et parfois un
  saut). `demuxer-lavf-probesize` / `analyzeduration` n'y changent rien ; `audio-buffer=0.1` RETARDE le
  premier son (p50 71 → 101 ms). Chrome (`<audio>`) attend ~32 ko et sort ~45 ms après mpv.
- `mpv_terminate_destroy` a tenu une fois le fil principal 1,5 s ; `quit` puis
  `mpv_destroy` à l'arrêt : ~60 ms. L'appel « async » de koffi : SIGSEGV.
