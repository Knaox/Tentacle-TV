# Banc du transcodage lent (Apple TV)

L'app TV RÉELLE au simulateur, devant un serveur qui transcode lentement —
sans compte, sans toucher au Jellyfin partagé ni au backend de dev. Un faux
Tentacle et un faux Jellyfin (mode proxy : tout passe par `/api/jellyfin`)
servent un seul titre, « Banc transcodage » (MP4 h264/aac : ni PrismCore ni
lecture directe, PlaybackInfo répond « transcodage »), et un HLS généré
localement, que libère un « encodeur » simulé à la vitesse voulue. Écrit pour
le chantier « transcodage lent ≠ connexion lente » (`docs/TV-REFONTE.md`).

## 1. Le contenu

Une fois (ffmpeg requis, ~1 min) — une mire de 10 min, segments TS de 6 s :

```bash
node apps/tv/harness/slow-transcode/makeHls.mjs
```

## 2. Le faux serveur

```bash
node apps/tv/harness/slow-transcode/fakeServer.mjs
```

Port 8650 (`PORT`), contenu dans `hls/` (`HLS_DIR`). Il écoute 127.0.0.1 ET
::1 : l'app doit viser `http://localhost:8650` — une URL en `127.0.0.1` est
prise pour le bouclage de PrismCore par `AVPlayerSurface`.

L'« encodeur », par PlaySessionId : il démarre au premier segment demandé (et
repart s'il est demandé loin devant, comme Jellyfin), sort son premier
segment après `startup` ms, puis produit à `speed` × le temps réel ; une
demande de segment pas encore produit est TENUE jusqu'à sa production.

```bash
curl "http://localhost:8650/__mode?speed=0.3&startup=20000"
```

| Paramètre | Effet |
|---|---|
| `speed` | vitesse de l'encodeur (×) ; `0` : plus rien ne sort (transcodage mort) |
| `startup` | délai du premier segment d'une session (ms) |
| `bitrate` | débit du témoin `Playback/BitrateTest` (b/s ; `0` : libre) |
| `segrate` | débit des segments (b/s ; `0` : celui du témoin) |

`/__log` : PlaybackInfo, playlists, segments demandés, abandonnés par le
lecteur, servis ; `/__reset` : vide le journal et les sessions.

## 3. L'app

Un clone de simulateur À SOI, une build Debug de l'app, un Metro à soi (dans
un worktree : enveloppe de config qui surveille les `node_modules` liés et
exclut `ios/Pods` et les builds — sans quoi le premier paquet dépasse le
délai de l'app). Simulateur ÉTEINT, dans le plist du conteneur
(`plistlib` — PlistBuddy retire les guillemets d'un JSON) :
`RCT_jsLocation` = `localhost:<port Metro>`, `tentacle_server_url` =
`http://localhost:8650`, `tentacle_token` = `banc` (bidon),
`tentacle_user` = `{"Id":"banc-user","Name":"Banc"}`.

Le lecteur s'ouvre par CDP (Hermes, via Metro) :
`navigationRef.navigate("Player", { itemId: "banc-film" })` (module
`src/navigation/navigationRef.ts`).

## 4. Ce qu'on éprouve

| Scénario | Mode | Attendu |
|---|---|---|
| Ouverture lente | `speed=0.3&startup=20000` | « Le transcodage peut prendre un peu plus de temps » dès 6 s ; relance douce de la MÊME session à 30 s ; première image sans échec |
| Transcodage mort | `speed=0` | relances douces, puis l'échec à 2 min : « aucune image n'est arrivée depuis deux minutes », Réessayer |
| Changement de qualité | lecture à `speed=8`, puis `speed=0.4&startup=25000` et un palier choisi | image figée, ligne discrète, jamais de session neuve (une seule PlaybackInfo par choix) |
| Réseau trop lent | `bitrate=5000000&segrate=400000`, app RELANCÉE (la mesure vit 10 min), 1080p choisi | « La connexion est trop lente — réseau mesuré à 5 Mb/s : cette qualité en demande 8 Mb/s » |

Observer : `/__log`, les traces `[TVDIAG] [recover]` de Metro, et la sonde
native par CDP (`NativeModules.TentaclePlayerProbe.loadState()` : octets
reçus, mémoire chargée, état d'AVPlayer et raison de son attente).

## Pièges

- Le témoin de débit doit être `no-store` : servi par le cache HTTP de
  l'app, il « mesurait » un réseau infini.
- Le `fetch` de React Native ne rend la réponse qu'avec le corps entier : la
  TV mesure en `bufferedFetch` (api-client) — sans lui, 115 Mb/s partout.
- Jamais le Jellyfin partagé avec la production : ce banc n'en a pas besoin.
