# Release Notes — Tentacle TV (Android TV)

## v0.9.5 — Audio DTS, buffer bar & AV1 support

### Corrections

- **Fix audio DTS** — suppression de l'override `buildAudioSink` dans ExoPlayer. Media3 1.8.0 auto-détecte les capacités audio du device (passthrough DTS/DTS-HD MA, AC3, EAC3, TrueHD) sans configuration manuelle.
- **Fix barre de préchargement** — les events `progress` sont désormais émis en continu (polling 250ms) indépendamment de `isPlaying`, ce qui permet l'affichage correct de la barre de buffer pendant le chargement initial et les seeks.

### Nouveautés

- **AV1 software decoding** — ajout du décodeur FFmpeg Jellyfin (`org.jellyfin.media3:media3-ffmpeg-decoder:1.8.0+1`) qui inclut dav1d pour le décodage AV1. Activé automatiquement via `EXTENSION_RENDERER_MODE_ON` quand MediaCodec ne supporte pas le codec.
- **Alignement Media3 1.8.0** — toutes les dépendances Media3 sont sur la version 1.8.0 (exoplayer, hls, ui, ffmpeg-decoder).

### Nettoyage

- Suppression des logs diagnostic (renderer audio, `onIsPlayingChanged`, `onAudioSessionIdChanged`)
- Remplacement du repo GitHub `niclas-AIO` par Maven Central (le package Jellyfin y est publié directement)

---

## HDR, Dolby Vision & Dolby Atmos — Architecture dual-player

### Nouveau : ExoPlayer/Media3 pour le contenu HDR

L'app Android TV utilise désormais une **architecture dual-player** inspirée de VoidTV et Plex :

- **MPV** pour le contenu SDR — seek rapide, subtitles ASS/SSA, filtres vidéo
- **ExoPlayer (Media3)** pour le contenu HDR/DV — MediaCodec en mode surface avec HDR passthrough natif

La détection est automatique via `VideoRangeType` depuis les métadonnées Jellyfin. Aucune configuration nécessaire.

### HDR10 / HDR10+ — Direct Play

ExoPlayer utilise `SurfaceView` (pas `TextureView`) avec MediaCodec en mode surface, ce qui préserve les métadonnées HDR et les envoie directement au pipeline d'affichage Android → HDMI → TV. Le badge HDR s'affiche automatiquement sur la TV.

Fonctionne sur tous les Android TV modernes (Shield, Chromecast, Fire TV, etc.).

### Dolby Vision — Profiles 5, 8 et 7

| Profile | Support | Méthode |
|---------|---------|---------|
| **P5** | Direct Play | Décodeur natif si disponible sur le device |
| **P8** | Direct Play | Décodeur natif `dvhe.08` (Shield Pro, Fire TV 4K Max, etc.) |
| **P7** | Rewrite P7→P8.1 | `DvCompatRenderer` — réécrit le codec string `dvhe.07.*` → `dvhe.08.*` pour utiliser le décodeur P8 du device |

Le `DvCompatRenderer` détecte au démarrage si le device supporte P8 mais pas P7, et active la réécriture automatiquement. Technique prouvée par les projets JellyDV et VoidTV.

**Limitation :** seul le MEL (Minimal Enhancement Layer) est converti. Le FEL (Full Enhancement Layer) du Profile 7 n'est pas supporté — le base layer HDR10 est utilisé comme fallback.

### Audio Passthrough HDMI

L'`ExoPlayer` utilise `DefaultAudioSink` configuré avec les vraies `AudioCapabilities` du device (pas les capacités par défaut qui sont PCM-only). Le bitstream audio est envoyé directement via HDMI vers l'AVR/soundbar :

| Format | Passthrough | Condition |
|--------|-------------|-----------|
| **AC3** | Oui | Large support device |
| **EAC3** | Oui | Large support device |
| **EAC3 JOC (Dolby Atmos)** | Oui | Device/AVR reporte `ENCODING_E_AC3_JOC` |
| **TrueHD (Dolby Atmos)** | Oui | Nvidia Shield uniquement |
| **DTS** | Oui | Large support device |
| **DTS-HD MA / DTS:X** | Oui | Shield et devices sélectionnés |
| **Fallback** | Décodage PCM | Automatique si passthrough non disponible |

Le player MPV (SDR) conserve sa propre configuration audio avec `audio-spdif` via `ENCODING_IEC61937` pour AC3/EAC3 basique.

### Interface identique

Les deux players exposent la même interface React Native (`seek`, `setAudioTrack`, `setSubtitleTrack`). Les composants d'overlay sont réutilisés sans modification :

- `TVPlayerOverlay` — contrôles de lecture, timeline, vitesse
- `TVTrackSelector` — sélection audio/sous-titres
- `TVSkipSegmentButton` — skip intro/crédits

### Fallback automatique

- Si ExoPlayer rencontre une erreur codec sur du contenu HDR → fallback vers transcode serveur (SDR, 8 Mbps) via MPV
- Le contenu SDR continue d'utiliser MPV directement

### Fichiers ajoutés/modifiés

| Fichier | Description |
|---------|-------------|
| `exoplayer/ExoPlayerView.kt` | Player natif Media3 + SurfaceView HDR + audio passthrough |
| `exoplayer/DvCompatRenderer.kt` | Dolby Vision Profile 7 → 8.1 rewrite |
| `exoplayer/ExoViewManager.kt` | Bridge React Native (props, commands, events) |
| `exoplayer/ExoPackage.kt` | Enregistrement du package React Native |
| `components/player/ExoPlayer.tsx` | Composant React Native miroir de MPVPlayer |
| `screens/PlayerScreen.tsx` | Détection HDR + routing conditionnel MPV/ExoPlayer |
| `MainApplication.kt` | Ajout `ExoPackage()` |
| `build.gradle` | Dépendances Media3 (exoplayer, hls, ui) |

### Vérification

```bash
# Build
cd apps/tv/android && ./gradlew assembleDebug

# Install
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Logs ExoPlayer
adb logcat -s ExoPlayerView

# Logs MPV
adb logcat -s MpvPlayerView
```

### Tests recommandés

1. **SDR** — Film SDR → MPV, seek rapide, subtitles OK
2. **HDR10** — Film 4K HDR → ExoPlayer, badge HDR sur TV, couleurs correctes
3. **Dolby Vision P8** — Film DV P8 → ExoPlayer, DV actif sur TV
4. **Dolby Vision P7** — Remux UHD P7 → ExoPlayer, DV via P7→P8.1 rewrite
5. **Atmos EAC3** — Contenu streaming → passthrough, Atmos affiché sur AVR
6. **TrueHD Atmos** — Remux avec TrueHD → passthrough vers AVR (Shield)
7. **Fallback** — Film DV sur device sans DV → HDR10 base layer, pas de crash
8. **Audio fallback** — Casque Bluetooth → PCM décodé, pas de passthrough
