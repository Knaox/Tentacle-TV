# Banc serveur local (pont)

Pile **jetable** Tentacle + Jellyfin sous colima, pour charger le front de Tentacle dans le
proto et lire de vrais médias. Jamais le serveur de Damien, jamais un compte réel.

| | |
|---|---|
| Tentacle (front web + API) | `http://127.0.0.1:3471` — image `ghcr.io/knaox/tentacle-tv:latest` = **1.42.0** (id `sha256:3259d287…`), capacités `music.*`/`octave.rights` présentes |
| Jellyfin | `http://127.0.0.1:8471` — image `jellyfin/jellyfin:12` = **12.4** |
| Médias | `~/.cache/tentacle-cef/media` monté en LECTURE SEULE sur `/media` |
| Bibliothèques | **Films** → `media/films/` (vidéo-HDR), **Musique** → `media/musique/` (octave), **Séries** → `media/series/` (pont : épisode suivant) |
| Comptes de test | `~/.cache/tentacle-cef/banc/comptes.json` (0600) : `admin` (administrateur Jellyfin/Tentacle) et `user` (non administrateur) |

Les deux ports ne sont liés qu'à `127.0.0.1`. Le CORS de Jellyfin répond `*` (mesuré :
préflight `OPTIONS /Sessions/Playing` depuis `http://127.0.0.1:3471` → 204,
`Access-Control-Allow-Origin: *`) : la lecture directe marche depuis l'origine du serveur, sans
relais natif.

## Mode d'emploi

```bash
bench/server/banc.sh up       # démarre (≈ 30 s au premier lancement)
bench/server/banc.sh setup    # joue l'assistant PAR SON API + bibliothèques + compte non admin
bench/server/banc.sh libs     # après un dépôt de médias : (re)crée les bibliothèques, relance l'analyse
bench/server/banc.sh status
bench/server/banc.sh down     # arrête, garde les données
bench/server/banc.sh reset    # efface tout (volumes + comptes.json)
```

Se connecter dans le proto : ouvrir `http://127.0.0.1:3471`, identifiants de `comptes.json`
(`jq .admin ~/.cache/tentacle-cef/banc/comptes.json`). Ajouter un média : le déposer sous
`~/.cache/tentacle-cef/media/films/<Titre (Année)>/` puis `banc.sh libs` (l'analyse temps réel est
coupée : les fichiers fabriqués à moitié ne doivent pas être indexés).

## Pourquoi l'assistant par l'API et pas au navigateur

L'e2e de Tentacle (`apps/server-e2e/src/fullStack.e2e.ts`) le mène dans Chrome. Ici on rejoue les
MÊMES appels que la page (`/api/setup/session` avec un code neuf de `tentacle setup token`,
`/jellyfin/select`, `/jellyfin/initialize`, `/jellyfin/libraries`, `/complete`) : sans navigateur,
rejouable, et sans les greffons de détection des passages (téléchargés depuis GitHub par
Jellyfin — inutiles au proto). L'en-tête `Origin: http://127.0.0.1:3471` de `/complete` est
celui que Tentacle ajoute aux `CorsHosts` de Jellyfin. La Musique passe par l'API de Jellyfin :
l'assistant ne crée que films/séries.

## Médias de contrôle du pont

`media/films/Banc Pistes SDR (2026)/` — 120 s, H.264 720p, 2 pistes audio (fra « Français »,
eng « English », sinus 440/660 Hz), 2 sous-titres SRT (fra, eng). Sert aux essais de pistes et
de seek ; les médias HDR10/DV sont ceux de vidéo-HDR.
