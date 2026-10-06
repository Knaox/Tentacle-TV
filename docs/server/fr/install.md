# Installer Tentacle

*English version: [../install.md](../install.md).*

## Quelle pile ?

| Pile | Contient | À choisir quand |
|---|---|---|
| **tentacle-full** (conseillée) | Tentacle, sa base, **Jellyfin** | vous partez de zéro, ou voulez tout au même endroit |
| **tentacle-db** | Tentacle et sa base | Jellyfin tourne déjà ailleurs (NAS, autre conteneur, installation native) |
| **tentacle-only** | Tentacle seul | vous avez déjà MariaDB/MySQL et Jellyfin |

Chaque pile est un seul `compose.yaml`, prêt à copier, avec un `.env.example` commenté à côté. **Rien n'est
obligatoire dans `.env`** : chaque valeur a un défaut qui marche. Aucune pile n'embarque de mandataire : pour
le HTTPS depuis Internet, placez Tentacle derrière le vôtre ([remote-access.md](remote-access.md)).

```bash
mkdir tentacle && cd tentacle
# UNE des trois :
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-full/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-db/compose.yaml
curl -fsSLo compose.yaml https://raw.githubusercontent.com/Knaox/Tentacle-TV/main/stacks/tentacle-only/compose.yaml
docker compose up -d
```

## Premier démarrage : le code d'installation

```bash
docker compose logs tentacle
```

affiche un bloc comme :

```
  Tentacle — setup code / code d'installation : ABCD-EFGH-JKMN
  http://<this-server>:3000/setup#code=ABCD-EFGH-JKMN
```

Ouvrez le lien (remplacez `<this-server>` par l'adresse de la machine) : le code est déjà rempli. Il ne sert
qu'une fois, et il est aussi écrit dans `data/setup-token.txt` du volume de données. Perdu ou déjà utilisé ?
Un neuf :

```bash
docker compose exec tentacle tentacle setup token
```

## L'assistant, pas à pas

Une question par écran ; les étapes s'adaptent à la pile détectée.

1. **Bienvenue** — la langue.
2. **Code d'installation.**
3. **Base de données** — *tentacle-only* seulement : hôte, port, base, compte. Depuis Docker, `localhost` est
   Tentacle lui-même : utilisez `host.docker.internal` ou l'adresse de la machine.
4. **Jellyfin** —
   - *tentacle-full* : le Jellyfin voisin a été **verrouillé dès le démarrage** (personne d'autre ne peut le
     prendre) ; l'assistant le configure avec le compte choisi ensuite ;
   - *tentacle-db / tentacle-only* : donnez l'adresse de Jellyfin. Neuf → Tentacle le configure ; déjà
     configuré → connexion avec son compte administrateur (Tentacle crée sa clé d'API lui-même), ou une clé
     collée.
5. **Compte** — le compte administrateur de Jellyfin, qui l'est aussi de Tentacle.
6. **Langue et pays des métadonnées.**
7. **Bibliothèques** — *tentacle-full* propose **Films** (`/media/films`) et **Séries** (`/media/series`) ;
   parcourez les dossiers de Jellyfin pour en ajouter.
8. **Récapitulatif**, puis **installation** (chaque étape ratée se relance seule).
9. **Accès à distance** (facultatif) — le HTTPS par votre propre mandataire : voir [remote-access.md](remote-access.md).
10. **Et maintenant ?** — où déposer vos fichiers, les applications de chaque plateforme, un QR code pour
    ouvrir le serveur.

## Réglages (`.env`)

Copiez `.env.example` en `.env` à côté de `compose.yaml`, décommentez ce qu'il faut, puis `docker compose up -d`.

| Variable | Défaut | |
|---|---|---|
| `MEDIA_PATH` | `./media` | *full* : votre dossier des médias sur cette machine (Jellyfin le voit en `/media`) |
| `TENTACLE_PORT` | `3000` | le port de Tentacle sur cette machine |
| `JELLYFIN_PORT` | `8096` | *full* : le port de Jellyfin sur cette machine |
| `JELLYFIN_DISCOVERY_PORT` | `7359` | *full* : le port UDP de découverte de Jellyfin (à changer si un autre Jellyfin tourne ici) |
| `PUID` / `PGID` | `1000` | le compte propriétaire de vos fichiers (`id -u`, `id -g`) |
| `TZ` | `Europe/Paris` | le fuseau horaire |
| `TENTACLE_VERSION` | `latest` | une version figée (ex. `v1.23.0`) pour ne mettre à jour que quand vous le décidez |

Variables du serveur, à poser dans `compose.yaml` (`environment:`) pour les cas particuliers :

| Variable | |
|---|---|
| `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` / `DB_PASSWORD_FILE` | la base, donnée par l'environnement plutôt que par l'assistant |
| `TENTACLE_PUBLIC_URL` | lien public de repli (celui réglé dans l'administration l'emporte) |
| `TRUSTED_PROXIES` | mandataires de plus dont `X-Forwarded-For` est cru (IP ou CIDR, séparés par des virgules) — voir [remote-access.md](remote-access.md#mandataires-de-confiance) |
| `REMOTE_CHECK_URL` | le service de test d'ouverture (`off` pour le couper) |

## Podman

Les piles marchent avec `podman compose` (ou `podman-compose`). Le volume des médias porte `:z` pour SELinux.
Sans root : ajoutez `userns_mode: keep-id` aux services `jellyfin` et `tentacle` pour que les fichiers restent
à vous. Transcodage matériel avec Podman : voir [gpu.md](gpu.md#podman).

## Sans Docker

Tentacle tourne aussi en natif (`node apps/backend/dist/index.js` depuis une compilation). Sans Jellyfin sur
la machine, l'assistant donne la commande officielle d'installation de Jellyfin (Debian/Ubuntu) ou son guide
officiel, puis attend que Jellyfin réponde sur `http://127.0.0.1:8096`. Les piles Docker restent la voie
prise en charge.
