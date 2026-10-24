# Banc Octave — un Jellyfin JETABLE avec une bibliothèque musique témoin

Le Jellyfin de dev EST celui de prod : on n'y écrit jamais. Tout le lot Octave
(lecteur, musique Jellyfin, mode Octave, extension Sillon, Lidarr) s'éprouve ici.
Jamais lancé par `pnpm test`.

```bash
bench/octave/up.sh          # réseau, fichiers témoins, Jellyfin :8196, comptes (idempotent)
bench/octave/add-track.sh   # ajoute « Nouvelle venue » et prévient Jellyfin (preuve des événements)
bench/octave/add-track.sh --remove
bench/octave/down.sh        # retire le conteneur et ses volumes (garde la musique)
bench/octave/down.sh --music
```

| | |
|---|---|
| Conteneur | `octave-jellyfin` (`jellyfin/jellyfin:10.11`), `127.0.0.1:8196`, réseau Docker `octave-bench` (alias `octave-jellyfin:8096` pour le Lidarr du banc) |
| Musique | `/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-music` → `/music` (lecture seule) |
| État | `/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/jellyfin.env` (0600) : URL, clé d'API, ids des bibliothèques, ids / mots de passe / jetons des comptes |
| Bibliothèques | « Musique » (`music`, surveillance en temps réel, aucun fournisseur Internet, ARTISTS préféré) ; « Films » (vide) |
| Réglages | `LibraryMonitorDelay` et `LibraryUpdateDuration` à 5 s (au lieu de 60 et 30) : un ajout est vu en secondes |
| Comptes | `admin` (administrateur), `octave1` et `octave2` (tout), `octave-sans` (Films seulement : ne voit AUCUNE musique) |

Les mots de passe sont ceux du banc (dans `jellyfin.env`) — jamais des comptes réels.

## Un backend Tentacle sur le banc

Chaque agent a SON dossier de données et SON port (voir le brief du lot) :

```bash
cd apps/backend
D="/Users/damienrouge/Desktop/Projet - local/.claude/octave/bench-state/a3-data"   # le tien
node "$(node -p 'require.resolve("tsx/cli")')" ../../bench/octave/backend-seed.cts "$PWD" "$D"
PORT=3103 HOST=127.0.0.1 TENTACLE_DATA_DIR="$D" node "$(node -p 'require.resolve("tsx/cli")')" src/index.ts
```

Connexion : `POST /api/auth/login` avec `octave1` / son mot de passe (navigateur : le vrai
formulaire, une fois par origine — un login d'API sans `deviceId` chasse les autres sessions).

## Les fichiers témoins (26 titres, 6 albums, 3 artistes)

Son SYNTHÉTIQUE (ffmpeg `aevalsrc`), aucun contenu protégé. Tags par `seed/tags.py`
(mutagen 1.47.0, venv dans le dossier d'état), mêmes clés que Picard.

| Album | Format | Particularité |
|---|---|---|
| Kevin MacLeod — Bright Piano Works (2007, EP) | FLAC 16/44,1 | MBID RÉELS |
| Kevin MacLeod — Elegant Piano (2006) | FLAC 24/96 | MBID RÉELS, haute résolution |
| Kevin MacLeod — Polka! Polka! Polka! (2006) | MP3 V0 + 320 CBR | MBID RÉELS, apostrophe typographique |
| Banc Octave — Enchaînement continu (2026) | FLAC 16/44,1 | **gapless** : un seul balayage (220 Hz + 6 Hz/s) coupé en 5, en pleine onde — tout blanc s'entend |
| Banc Octave — Formats témoins (2026) | ALAC, AAC 256k, Opus 160k, WAV, **DSF (DSD64)**, MP3 320 | un titre par format ; le DSD n'a PAS de ReplayGain |
| Ensemble Témoin — Duos d'été (2025) | Opus | accents (« Été à Noël », « Œuvre crépusculaire »), un titre à DEUX artistes |

- **MBID réels** : Kevin MacLeod (CC BY 4.0) — artiste `8292bf44-2dd1-4bad-8019-276ec38f28e7`,
  releases et enregistrements relevés sur musicbrainz.org le 2026-10-24 (`seed/catalog.py`).
  Le son n'est pas le sien et les durées sont raccourcies (20 s) : seul l'appariement compte.
- **MBID de test** : `0c7a0e00-0000-4000-8xxx-…` (« octave »), forme d'UUID valide, absents de
  MusicBrainz : `…-8000-…a1` Banc Octave, `…a2` Ensemble Témoin, `-800b-` releases,
  `-800c-` release groups, `-800d-` enregistrements (`…101`-`105` gapless, `201`-`206` formats,
  `301`-`303` duos, `901` le titre tardif).
- **ReplayGain** MESURÉ (EBU R128 de ffmpeg, référence −18 LUFS), titre ET album, crêtes vraies.
  Jellyfin 10.11 en tire `NormalizationGain` (gain de titre) sauf pour le MP4 (ALAC, AAC) et le DSF.

Relevés Jellyfin 10.11 (2026-10-24) : `ProviderIds.MusicBrainzRecording` = l'enregistrement
(Vorbis `MUSICBRAINZ_TRACKID`, MP4 « MusicBrainz Track Id », ID3 `UFID`) ; le DSF se lit
`dsd_lsbf_planar`, `SampleRate` 352800 et `BitDepth` 8 (octets : à multiplier par 8) ;
`PreferNonstandardArtistsTag` est nécessaire pour qu'un titre à deux artistes en ait deux.

**Ce que le Mac écrit, Jellyfin ne le voit pas seul** : colima ne propage pas les évènements
inotify de l'hôte vers le conteneur (sonde `inotifyd` du 2026-10-24 : rien). Qui écrit dans le
dossier prévient Jellyfin (`POST /Library/Media/Updated`, ce que fait Lidarr, et `add-track.sh`) ;
mesuré : le titre est dans Jellyfin 6 s après l'appel (retrait : 5 s). Relancer `up.sh` garde les
jetons encore valides (les agents ne sont pas déconnectés).

## Mesurer et écouter

```bash
node bench/octave/search-latency.mjs http://127.0.0.1:3103 "<jeton Tentacle>"     # 20 frappes, p50 / p95
node bench/octave/music-events.mjs ws://127.0.0.1:3103/api/ws "<jeton Tentacle>" 60  # music:* reçus, horodatés
node "$(node -p 'require.resolve("tsx/cli")')" ../../bench/octave/measure-refresh.cts           # (depuis apps/backend) notifyPath vs refreshPath
```
